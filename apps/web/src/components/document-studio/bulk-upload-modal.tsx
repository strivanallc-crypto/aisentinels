'use client';

/**
 * BulkUploadModal — 4-stage bulk import with client-side AI classification.
 *
 * Stage 1: 'select'    — Dropzone + file list + validation
 * Stage 2: 'analyzing' — Text extraction + AI classification per file
 * Stage 3: 'review'    — Editable results table (doc type, standards, confidence)
 * Stage 4: 'complete'  — Import results with links to created documents
 */

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  File as FileIcon,
  FileType2,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiApi, documentsApi } from '@/lib/api';
import type { DocType } from '@/lib/types';
import { DOC_TYPE_LABELS } from '@/lib/types';
import * as pdfjsLib from 'pdfjs-dist';

// pdfjs-dist worker setup — required or PDF extraction silently fails
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
// TODO: If CDN is blocked by CSP, copy worker to /public/pdf.worker.min.js and use:
// pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_CHARS = 2000; // First 2000 chars for AI context
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

const STANDARD_COLORS: Record<string, { text: string; bg: string; on: string }> = {
  iso_9001: { text: '#60a5fa', bg: 'rgba(59,130,246,0.10)', on: '#3B82F6' },
  iso_14001: { text: '#4ade80', bg: 'rgba(34,197,94,0.10)', on: '#22C55E' },
  iso_45001: { text: '#fbbf24', bg: 'rgba(245,158,11,0.10)', on: '#F59E0B' },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Stage = 'select' | 'analyzing' | 'review' | 'complete';

interface FileEntry {
  file: File;
  id: string;
  valid: boolean;
  error?: string;
  status: 'pending' | 'extracting' | 'classifying' | 'classified' | 'creating' | 'created' | 'failed';
  extractedText?: string;
  // AI classification results (editable by user)
  detectedTitle?: string;
  detectedType?: DocType;
  detectedStandards?: string[];
  confidence?: number;
  clauseRefs?: string[];
  // Final
  documentId?: string;
  errorMessage?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExt(file: File): string {
  return (file.name.toLowerCase().split('.').pop() ?? '').toLowerCase();
}

function getFileIcon(name: string) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return <FileIcon className="h-4 w-4 flex-shrink-0 text-red-400" />;
  if (ext === 'docx') return <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />;
  return <FileType2 className="h-4 w-4 flex-shrink-0 text-gray-400" />;
}

let entryCounter = 0;
function nextId(): string {
  return `file-${++entryCounter}-${Date.now()}`;
}

// ── Text Extraction ──────────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pages.push(text);
  }
  return pages.join('\n\n').slice(0, MAX_TEXT_CHARS);
}

async function extractDocxText(file: File): Promise<string> {
  // Dynamic import to avoid SSR issues
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.slice(0, MAX_TEXT_CHARS);
}

async function extractTxtText(file: File): Promise<string> {
  const text = await file.text();
  return text.slice(0, MAX_TEXT_CHARS);
}

// Full text extraction for classification context only — not stored
async function extractText(file: File): Promise<string> {
  const ext = getFileExt(file);
  if (ext === 'pdf') return extractPdfText(file);
  if (ext === 'docx') return extractDocxText(file);
  if (ext === 'txt') return extractTxtText(file);
  throw new Error(`Unsupported file type: .${ext}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function BulkUploadModal({ open, onClose, onComplete }: BulkUploadModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('select');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [totalCreated, setTotalCreated] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStage('select');
    setFiles([]);
    setTotalCreated(0);
    setTotalFailed(0);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ── File selection ─────────────────────────────────────────────────────────

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const entries: FileEntry[] = arr.map((file) => {
      const ext = getFileExt(file);
      const validExt = ACCEPTED_EXTENSIONS.includes(`.${ext}`);
      const oversize = file.size > MAX_FILE_SIZE;
      return {
        file,
        id: nextId(),
        valid: validExt && !oversize,
        error: !validExt
          ? 'Only PDF, DOCX, and TXT files'
          : oversize
            ? 'File too large (max 10MB)'
            : undefined,
        status: 'pending' as const,
      };
    });
    setFiles((prev) => [...prev, ...entries].slice(0, MAX_FILES + 5));
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
      e.target.value = '';
    },
    [addFiles],
  );

  // ── Validation ─────────────────────────────────────────────────────────────

  const validFiles = files.filter((f) => f.valid);
  const hasErrors = files.some((f) => !f.valid);
  const tooMany = files.length > MAX_FILES;
  const canStart = validFiles.length > 0 && !tooMany && !hasErrors;

  // ── Analysis flow ──────────────────────────────────────────────────────────

  const startAnalysis = useCallback(async () => {
    setStage('analyzing');

    for (const entry of validFiles) {
      // Extract text
      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: 'extracting' as const } : f)),
      );

      let text = '';
      try {
        text = await extractText(entry.file);
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: 'failed' as const, errorMessage: 'Text extraction failed' }
              : f,
          ),
        );
        continue;
      }

      // Classify with AI
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? { ...f, status: 'classifying' as const, extractedText: text }
            : f,
        ),
      );

      try {
        const res = await aiApi.clauseClassify({
          documentText: text,
          fileName: entry.file.name,
        });

        const data = res.data as {
          clauses?: { clause: string; standard: string; confidence: number }[];
          detectedType?: DocType;
          detectedStandards?: string[];
          detectedTitle?: string;
          confidence?: number;
          docType?: DocType;
          standards?: string[];
          title?: string;
        };

        // Parse AI response — handle various response shapes
        const detectedType: DocType =
          data.detectedType ?? data.docType ?? 'procedure';
        const detectedStandards: string[] =
          data.detectedStandards ??
          data.standards ??
          [...new Set((data.clauses ?? []).map((c) => c.standard).filter(Boolean))];
        const confidence: number =
          data.confidence ??
          (data.clauses && data.clauses.length > 0
            ? Math.round(data.clauses.reduce((s, c) => s + c.confidence, 0) / data.clauses.length)
            : 50);
        const clauseRefs: string[] = (data.clauses ?? []).map((c) => c.clause);
        const detectedTitle: string =
          data.detectedTitle ?? data.title ?? entry.file.name.replace(/\.[^.]+$/, '');

        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: 'classified' as const,
                  detectedTitle,
                  detectedType,
                  detectedStandards,
                  confidence,
                  clauseRefs,
                }
              : f,
          ),
        );
      } catch {
        // Classification failed — allow manual entry
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: 'classified' as const,
                  detectedTitle: entry.file.name.replace(/\.[^.]+$/, ''),
                  detectedType: 'procedure' as DocType,
                  detectedStandards: [],
                  confidence: 0,
                  clauseRefs: [],
                  errorMessage: 'Classification failed — edit manually',
                }
              : f,
          ),
        );
      }
    }

    setStage('review');
  }, [validFiles]);

  // ── Review edits ───────────────────────────────────────────────────────────

  const updateFileType = (id: string, docType: DocType) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, detectedType: docType } : f)),
    );
  };

  const toggleFileStandard = (id: string, std: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const current = f.detectedStandards ?? [];
        const next = current.includes(std)
          ? current.filter((s) => s !== std)
          : [...current, std];
        return { ...f, detectedStandards: next };
      }),
    );
  };

  // ── Confirm + Create ──────────────────────────────────────────────────────

  const confirmFile = useCallback(async (entry: FileEntry) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === entry.id ? { ...f, status: 'creating' as const } : f)),
    );

    try {
      const res = await documentsApi.create({
        title: entry.detectedTitle ?? entry.file.name.replace(/\.[^.]+$/, ''),
        docType: entry.detectedType ?? 'procedure',
        standards: entry.detectedStandards ?? [],
      });
      const doc = res.data as { id: string };
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? { ...f, status: 'created' as const, documentId: doc.id }
            : f,
        ),
      );
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? { ...f, status: 'failed' as const, errorMessage: 'Failed to create document' }
            : f,
        ),
      );
    }
  }, []);

  const confirmAll = useCallback(async () => {
    const reviewable = files.filter(
      (f) => f.status === 'classified' && f.valid,
    );

    for (const entry of reviewable) {
      await confirmFile(entry);
    }

    const updated = files;
    setTotalCreated(updated.filter((f) => f.status === 'created').length);
    setTotalFailed(updated.filter((f) => f.status === 'failed').length);
    setStage('complete');
    onComplete();
  }, [files, confirmFile, onComplete]);

  const confirmSingle = useCallback(
    async (entry: FileEntry) => {
      await confirmFile(entry);
    },
    [confirmFile],
  );

  // ── Computed ───────────────────────────────────────────────────────────────

  const analyzingCount = files.filter(
    (f) => f.status === 'extracting' || f.status === 'classifying',
  ).length;
  const classifiedCount = files.filter((f) => f.status === 'classified').length;
  const reviewFiles = files.filter((f) => f.valid && f.status !== 'pending');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
      title=""
      className="max-w-3xl"
    >
      {/* ── STAGE 1: File selection ── */}
      {stage === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              Bulk Upload &amp; AI Classification
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
              Upload up to 10 files. Doki will extract text and classify each document by ISO standard and type.
            </p>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/10 py-10 cursor-pointer transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <Upload className="h-8 w-8" style={{ color: 'var(--content-text-dim)' }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                Drop PDF, DOCX, or TXT files here
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
                or click to browse — max 10 files, 10MB each
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {/* Validation */}
          {tooMany && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Maximum {MAX_FILES} files allowed.
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {files.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: entry.valid ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.08)',
                    border: entry.valid ? '1px solid var(--content-border)' : '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  {getFileIcon(entry.file.name)}
                  <span className="flex-1 truncate" style={{ color: 'var(--content-text)' }}>
                    {entry.file.name}
                  </span>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--content-text-dim)' }}>
                    {formatFileSize(entry.file.size)}
                  </span>
                  {entry.error && (
                    <Badge variant="destructive" className="text-[10px] flex-shrink-0">
                      {entry.error}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                    className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-white/10"
                    style={{ color: 'var(--content-text-dim)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
              {files.length} of {MAX_FILES} files selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button disabled={!canStart} onClick={startAnalysis}>
                <Loader2 className="h-4 w-4 mr-1.5 hidden" />
                Start Analysis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 2: Analyzing ── */}
      {stage === 'analyzing' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              Analyzing {validFiles.length} File{validFiles.length > 1 ? 's' : ''}...
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
              Extracting text and classifying with AI. This may take a moment.
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {validFiles.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--content-border)' }}
              >
                {getFileIcon(entry.file.name)}
                <span className="flex-1 truncate text-sm" style={{ color: 'var(--content-text)' }}>
                  {entry.file.name}
                </span>
                {entry.status === 'pending' && (
                  <Badge variant="outline" className="text-[10px]">Waiting</Badge>
                )}
                {entry.status === 'extracting' && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                    Extracting
                  </Badge>
                )}
                {entry.status === 'classifying' && (
                  <Badge variant="secondary" className="text-[10px] text-indigo-400">
                    <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                    Classifying
                  </Badge>
                )}
                {entry.status === 'classified' && (
                  <Badge variant="default" className="text-[10px] bg-green-600/20 text-green-400">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Done
                  </Badge>
                )}
                {entry.status === 'failed' && (
                  <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-center" style={{ color: 'var(--content-text-dim)' }}>
            {analyzingCount > 0 ? `Processing ${analyzingCount} file${analyzingCount > 1 ? 's' : ''}...` : `${classifiedCount} of ${validFiles.length} classified`}
          </div>
        </div>
      )}

      {/* ── STAGE 3: Review ── */}
      {stage === 'review' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              Review Classification
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
              Edit document type and standards before importing. Confidence shows AI certainty.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--content-border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--content-border)' }}>
                  {['File', 'Title', 'Type', 'Standards', 'Confidence', ''].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px]"
                      style={{ color: 'var(--content-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviewFiles.map((entry, i) => {
                  const conf = entry.confidence ?? 0;
                  const confColor = conf >= 80 ? '#22c55e' : conf >= 50 ? '#f59e0b' : '#ef4444';
                  const confBg = conf >= 80 ? 'rgba(34,197,94,0.15)' : conf >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderTop: i > 0 ? '1px solid var(--content-border)' : undefined,
                        background: entry.status === 'failed' ? 'rgba(239,68,68,0.05)' : undefined,
                      }}
                    >
                      {/* Filename */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {getFileIcon(entry.file.name)}
                          <span className="truncate max-w-[120px]" style={{ color: 'var(--content-text)' }}>
                            {entry.file.name}
                          </span>
                        </div>
                      </td>
                      {/* Title */}
                      <td className="px-3 py-2.5">
                        <span className="truncate max-w-[140px] block" style={{ color: 'var(--content-text)' }}>
                          {entry.detectedTitle ?? '—'}
                        </span>
                      </td>
                      {/* Doc Type dropdown */}
                      <td className="px-3 py-2.5">
                        <select
                          value={entry.detectedType ?? 'procedure'}
                          onChange={(e) => updateFileType(entry.id, e.target.value as DocType)}
                          className="rounded border bg-transparent px-1.5 py-0.5 text-[11px] outline-none"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--content-surface)' }}
                        >
                          {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      {/* Standards pills */}
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {(['iso_9001', 'iso_14001', 'iso_45001'] as const).map((std) => {
                            const active = (entry.detectedStandards ?? []).includes(std);
                            const c = STANDARD_COLORS[std];
                            return (
                              <button
                                key={std}
                                onClick={() => toggleFileStandard(entry.id, std)}
                                className="rounded px-1.5 py-0.5 text-[9px] font-semibold transition-all"
                                style={{
                                  background: active ? `${c.on}22` : 'transparent',
                                  color: active ? c.on : 'var(--content-text-dim)',
                                  border: `1px solid ${active ? c.on : 'var(--border)'}`,
                                }}
                              >
                                {std.replace('iso_', '').toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      {/* Confidence */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-16 rounded-full overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.1)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${conf}%`, background: confColor }}
                            />
                          </div>
                          <span
                            className="text-[10px] font-bold tabular-nums"
                            style={{ color: confColor, background: confBg, padding: '1px 5px', borderRadius: '4px' }}
                          >
                            {conf}%
                          </span>
                        </div>
                        {entry.errorMessage && (
                          <span className="text-[10px] text-amber-400 block mt-0.5">{entry.errorMessage}</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        {entry.status === 'classified' && (
                          <button
                            onClick={() => confirmSingle(entry)}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold transition-colors"
                            style={{ background: 'rgba(194,250,105,0.15)', color: '#c2fa69' }}
                          >
                            Confirm
                          </button>
                        )}
                        {entry.status === 'creating' && (
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                        )}
                        {entry.status === 'created' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                        )}
                        {entry.status === 'failed' && (
                          <XCircle className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
              {reviewFiles.filter((f) => f.status === 'classified').length} ready to import
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={confirmAll}
                disabled={reviewFiles.filter((f) => f.status === 'classified').length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Confirm All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 4: Complete ── */}
      {stage === 'complete' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              Import Complete
            </h2>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            {totalCreated > 0 && (
              <div className="flex items-center gap-1.5 text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>{totalCreated} document{totalCreated !== 1 ? 's' : ''} created</span>
              </div>
            )}
            {totalFailed > 0 && (
              <div className="flex items-center gap-1.5 text-red-400">
                <XCircle className="h-4 w-4" />
                <span>{totalFailed} failed</span>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {files.filter((f) => f.valid).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                style={{
                  background: entry.status === 'created' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${entry.status === 'created' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}
              >
                {entry.status === 'created' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                )}
                <span className="flex-1 truncate" style={{ color: 'var(--content-text)' }}>
                  {entry.detectedTitle ?? entry.file.name}
                </span>
                {entry.status === 'created' && entry.documentId && (
                  <button
                    onClick={() => { handleClose(); router.push(`/document-studio/${entry.documentId}`); }}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors"
                    style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Editor
                  </button>
                )}
                {entry.status === 'failed' && (
                  <button
                    onClick={() => confirmSingle(entry)}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors"
                    style={{ background: 'rgba(245,158,11,0.10)', color: '#fbbf24' }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
