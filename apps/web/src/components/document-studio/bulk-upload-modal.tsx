'use client';

/**
 * BulkUploadModal — 3-stage bulk import for Document Studio.
 *
 * Stage 1: 'select'    — Dropzone + file list + validation
 * Stage 2: 'uploading' — Per-file progress bars + S3 upload + Omni triage
 * Stage 3: 'complete'  — Results table with sentinel + ISO standard
 */
import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  File as FileIcon,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { bulkUploadApi } from '@/lib/api';
import { BULK_LIMITS } from '@/types/bulk-upload';
import type { BulkUploadItem } from '@/types/bulk-upload';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (documentIds: string[]) => void;
}

type Stage = 'select' | 'uploading' | 'complete';

interface FileEntry {
  file: File;
  id: string;
  valid: boolean;
  error?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'completed' | 'failed';
  sentinel?: string;
  isoStandard?: string;
  documentId?: string;
  errorMessage?: string;
}

// ── Sentinel colors ──────────────────────────────────────────────────────────

const SENTINEL_COLORS: Record<string, string> = {
  Qualy: '#6366f1',
  Envi:  '#22c55e',
  Saffy: '#f59e0b',
  Doki:  '#8b5cf6',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(file: File): 'pdf' | 'docx' | null {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  return null;
}

let entryCounter = 0;
function nextId(): string {
  return `file-${++entryCounter}-${Date.now()}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BulkUploadModal({ open, onClose, onComplete }: BulkUploadModalProps) {
  const [stage, setStage] = useState<Stage>('select');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [statusText, setStatusText] = useState('');
  const [completedItems, setCompletedItems] = useState<Partial<BulkUploadItem>[]>([]);
  const [totalSucceeded, setTotalSucceeded] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStage('select');
    setFiles([]);
    setStatusText('');
    setCompletedItems([]);
    setTotalSucceeded(0);
    setTotalFailed(0);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ── File selection ───────────────────────────────────────────────────────

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const entries: FileEntry[] = arr.map((file) => {
      const ft = getFileType(file);
      const oversize = file.size > BULK_LIMITS.MAX_FILE_SIZE_BYTES;
      const invalidType = !ft;

      return {
        file,
        id: nextId(),
        valid: !oversize && !invalidType,
        error: invalidType
          ? 'PDF or DOCX only'
          : oversize
            ? 'Exceeds 25MB'
            : undefined,
        progress: 0,
        status: 'pending' as const,
      };
    });

    setFiles((prev) => {
      const combined = [...prev, ...entries];
      return combined.slice(0, 20); // allow adding but show error for > 10
    });
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

  // ── Validation ───────────────────────────────────────────────────────────

  const validFiles = files.filter((f) => f.valid);
  const hasErrors = files.some((f) => !f.valid);
  const tooMany = files.length > BULK_LIMITS.MAX_FILES;
  const canStart = validFiles.length > 0 && !tooMany && !hasErrors;

  // ── Upload flow ──────────────────────────────────────────────────────────

  const startUpload = useCallback(async () => {
    setStage('uploading');
    setStatusText('Requesting upload URLs...');

    try {
      // 1. Initiate — get presigned URLs
      const initiatePayload = validFiles.map((f) => ({
        filename: f.file.name,
        fileType: getFileType(f.file)!,
        fileSize: f.file.size,
      }));

      const initResult = await bulkUploadApi.initiate(initiatePayload);
      const batchId = initResult.batchId;

      // Map itemId back to our file entries
      const itemMap = new Map<string, string>(); // filename → itemId
      for (const item of initResult.items) {
        itemMap.set(item.filename, item.itemId);
      }

      // 2. Upload files to S3 in parallel
      setStatusText('Uploading files to secure storage...');

      const uploadResults = await Promise.allSettled(
        validFiles.map(async (entry) => {
          const serverItem = initResult.items.find((i) => i.filename === entry.file.name);
          if (!serverItem) throw new Error(`No presigned URL for ${entry.file.name}`);

          // Mark as uploading
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id ? { ...f, status: 'uploading' as const } : f,
            ),
          );

          await bulkUploadApi.uploadToS3(
            serverItem.presignedUrl,
            entry.file,
            (percent) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === entry.id ? { ...f, progress: percent } : f,
                ),
              );
            },
          );

          // Mark as uploaded
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? { ...f, status: 'uploaded' as const, progress: 100 }
                : f,
            ),
          );

          return serverItem.itemId;
        }),
      );

      // Collect successful item IDs
      const successfulItemIds: string[] = [];
      for (let i = 0; i < uploadResults.length; i++) {
        const result = uploadResults[i]!;
        if (result.status === 'fulfilled') {
          successfulItemIds.push(result.value);
        } else {
          // Mark failed
          const entry = validFiles[i]!;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? {
                    ...f,
                    status: 'failed' as const,
                    errorMessage: 'Upload to S3 failed',
                  }
                : f,
            ),
          );
        }
      }

      if (successfulItemIds.length === 0) {
        setStatusText('All uploads failed');
        setStage('complete');
        setTotalFailed(validFiles.length);
        return;
      }

      // 3. Process — Omni triage
      setStatusText('Omni is classifying your documents...');
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploaded' ? { ...f, status: 'processing' as const } : f,
        ),
      );

      const processResult = await bulkUploadApi.process(batchId, successfulItemIds);

      // 4. Update file entries with results
      const documentIds: string[] = [];
      const finalItems = processResult.items;

      setFiles((prev) =>
        prev.map((f) => {
          const itemId = itemMap.get(f.file.name);
          const resultItem = finalItems.find(
            (ri) => (ri as { itemId?: string }).itemId === itemId,
          );
          if (resultItem && resultItem.status === 'completed') {
            if (resultItem.documentId) documentIds.push(resultItem.documentId);
            return {
              ...f,
              status: 'completed' as const,
              sentinel: resultItem.sentinel,
              isoStandard: resultItem.isoStandard,
              documentId: resultItem.documentId,
              progress: 100,
            };
          } else if (resultItem && resultItem.status === 'failed') {
            return {
              ...f,
              status: 'failed' as const,
              errorMessage: resultItem.errorMessage ?? 'Processing failed',
            };
          }
          return f;
        }),
      );

      setCompletedItems(finalItems);
      setTotalSucceeded(processResult.succeeded);
      setTotalFailed(processResult.failed);
      setStage('complete');
      onComplete(documentIds);
    } catch (err) {
      setStatusText(
        `Error: ${err instanceof Error ? err.message : 'Upload failed'}`,
      );
      setTotalFailed(validFiles.length);
      setStage('complete');
    }
  }, [validFiles, onComplete]);

  // ── Computed for progress ────────────────────────────────────────────────

  const completedCount = files.filter(
    (f) => f.status === 'completed' || f.status === 'failed',
  ).length;
  const overallPercent =
    validFiles.length > 0
      ? Math.round(
          files.reduce((sum, f) => sum + f.progress, 0) / validFiles.length,
        )
      : 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
      title=""
      className="max-w-2xl"
    >
      {/* ── STAGE 1: File selection ── */}
      {stage === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              Bulk Import Documents
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
              Upload up to 10 PDF or DOCX files at once. Omni will classify and route each document automatically.
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
                Drop PDF or DOCX files here
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
                or click to browse — max 10 files, 25MB each
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {/* Validation errors */}
          {tooMany && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Maximum 10 files allowed. Remove {files.length - BULK_LIMITS.MAX_FILES} file(s) to continue.
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
                  {entry.file.name.endsWith('.pdf') ? (
                    <FileIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                  ) : (
                    <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />
                  )}
                  <span className="flex-1 truncate" style={{ color: 'var(--content-text)' }}>
                    {entry.file.name.length > 40
                      ? entry.file.name.slice(0, 37) + '...'
                      : entry.file.name}
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
              {files.length} of {BULK_LIMITS.MAX_FILES} files selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button disabled={!canStart} onClick={startUpload}>
                <Upload className="h-4 w-4 mr-1.5" />
                Start Upload
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 2: Uploading ── */}
      {stage === 'uploading' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              Uploading {validFiles.length} Document{validFiles.length > 1 ? 's' : ''}...
            </h2>
          </div>

          {/* Overall progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                {statusText}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--content-text)' }}>
                {completedCount}/{validFiles.length}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${overallPercent}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
          </div>

          {/* Per-file rows */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files
              .filter((f) => f.valid)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--content-border)',
                  }}
                >
                  {entry.file.name.endsWith('.pdf') ? (
                    <FileIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                  ) : (
                    <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />
                  )}
                  <span className="flex-1 truncate text-sm" style={{ color: 'var(--content-text)' }}>
                    {entry.file.name.length > 35
                      ? entry.file.name.slice(0, 32) + '...'
                      : entry.file.name}
                  </span>
                  {/* Status badge */}
                  {entry.status === 'pending' && (
                    <Badge variant="outline" className="text-[10px]">Waiting</Badge>
                  )}
                  {entry.status === 'uploading' && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                      {entry.progress}%
                    </Badge>
                  )}
                  {entry.status === 'uploaded' && (
                    <Badge variant="secondary" className="text-[10px] text-blue-400">Uploaded</Badge>
                  )}
                  {entry.status === 'processing' && (
                    <Badge variant="secondary" className="text-[10px] text-amber-400">
                      <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                      Classifying
                    </Badge>
                  )}
                  {entry.status === 'completed' && (
                    <Badge variant="default" className="text-[10px] bg-green-600/20 text-green-400">
                      Done
                    </Badge>
                  )}
                  {entry.status === 'failed' && (
                    <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                  )}
                  {/* Mini progress bar */}
                  <div
                    className="h-1 w-16 rounded-full overflow-hidden flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${entry.progress}%`,
                        background:
                          entry.status === 'failed'
                            ? '#ef4444'
                            : entry.status === 'completed'
                              ? '#22c55e'
                              : '#6366f1',
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── STAGE 3: Complete ── */}
      {stage === 'complete' && (
        <div className="flex flex-col gap-4">
          <div className="-mt-2 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              {totalFailed === validFiles.length ? 'Import Failed' : 'Import Complete'}
            </h2>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            {totalSucceeded > 0 && (
              <div className="flex items-center gap-1.5 text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>{totalSucceeded} document{totalSucceeded !== 1 ? 's' : ''} imported</span>
              </div>
            )}
            {totalFailed > 0 && (
              <div className="flex items-center gap-1.5 text-red-400">
                <XCircle className="h-4 w-4" />
                <span>{totalFailed} failed</span>
              </div>
            )}
          </div>

          {/* Results table */}
          {files.filter((f) => f.valid).length > 0 && (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--content-border)' }}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid var(--content-border)' }}>
                    {['Filename', 'Sentinel', 'ISO Standard', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--content-text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files
                    .filter((f) => f.valid)
                    .map((entry, i) => (
                      <tr
                        key={entry.id}
                        style={{
                          borderTop: i > 0 ? '1px solid var(--content-border)' : undefined,
                          background: entry.status === 'failed' ? 'rgba(239,68,68,0.05)' : undefined,
                        }}
                      >
                        <td className="px-3 py-2 truncate max-w-[200px]" style={{ color: 'var(--content-text)' }}>
                          {entry.file.name}
                        </td>
                        <td className="px-3 py-2">
                          {entry.sentinel ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full flex-shrink-0"
                                style={{ background: SENTINEL_COLORS[entry.sentinel] ?? '#6b7280' }}
                              />
                              <span style={{ color: 'var(--content-text)' }}>{entry.sentinel}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--content-text-dim)' }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {entry.isoStandard && entry.isoStandard !== 'unknown' ? (
                            <Badge variant="outline" className="text-[10px]">
                              {entry.isoStandard.replace('iso_', 'ISO ').replace('_', '')}
                            </Badge>
                          ) : (
                            <span style={{ color: 'var(--content-text-dim)' }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {entry.status === 'completed' && (
                            <span className="text-green-400">Imported</span>
                          )}
                          {entry.status === 'failed' && (
                            <span className="text-red-400" title={entry.errorMessage}>
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1">
            {totalFailed === validFiles.length && (
              <Button variant="outline" onClick={reset}>
                Try Again
              </Button>
            )}
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
