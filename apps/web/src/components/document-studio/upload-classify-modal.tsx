'use client';

import { useState, useRef } from 'react';
import { Upload, FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { aiApi, documentsApi } from '@/lib/api';
import { DOC_TYPE_LABELS } from '@/lib/types';
import type { DocType } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ClassificationResult {
  clauses: { clause: string; standard: string; confidence: number; excerpt: string }[];
  detectedType: DocType;
  detectedStandards: string[];
}

export function UploadClassifyModal({ open, onOpenChange, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setFileText('');
    setClassifying(false);
    setResult(null);
    setError(null);
    setSaving(false);
    setTitle('');
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setResult(null);
    setTitle(f.name.replace(/\.[^.]+$/, ''));

    try {
      const text = await f.text();
      if (!text.trim()) {
        setError('File appears to be empty or binary. Only plain text files are supported.');
        return;
      }
      setFileText(text.slice(0, 50000));
    } catch {
      setError('Could not read file. Only plain text files (.txt, .md, .csv) are supported.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleClassify = async () => {
    if (!fileText) return;
    setClassifying(true);
    setError(null);
    try {
      const res = await aiApi.clauseClassify({
        documentText: fileText,
        fileName: file?.name ?? 'upload.txt',
      });
      setResult(res.data as ClassificationResult);
    } catch {
      setError('Doki could not classify this document. Please try again.');
    } finally {
      setClassifying(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await documentsApi.create({
        title: title || file?.name || 'Uploaded Document',
        docType: result?.detectedType ?? 'external',
        content: fileText,
        standards: result?.detectedStandards ?? [],
        clauseRefs: result?.clauses.map((c) => `${c.standard} ${c.clause}`) ?? [],
      });
      onCreated();
      onOpenChange(false);
      reset();
    } catch {
      setError('Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title=""
      className="max-w-lg"
    >
      <div className="mb-4 flex items-center gap-3 -mt-2">
        <SentinelAvatar sentinelId="doki" size={32} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>Upload & Classify</h2>
          <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
            Doki will identify ISO clauses in your document
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-red-500/10 border-red-500/20 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Drop zone */}
      {!result && !classifying && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/10 bg-white/5 py-10 cursor-pointer transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5"
          >
            {file ? (
              <>
                <FileUp className="h-8 w-8 text-indigo-400" />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--content-text)' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" style={{ color: 'var(--content-text-dim)' }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                    Drop a text file or click to browse
                  </p>
                  <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
                    .txt, .md, .csv — max 50KB
                  </p>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.csv,.text"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>

          {file && fileText && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handleClassify}>
                <SentinelAvatar sentinelId="doki" size={16} className="mr-1.5" />
                Classify with Doki
              </Button>
            </div>
          )}
        </>
      )}

      {/* Classifying */}
      {classifying && (
        <div className="flex flex-col items-center gap-3 py-10">
          <SentinelAvatar sentinelId="doki" size={48} className="animate-pulse" />
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
          <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>Doki is analysing clauses…</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-400">Classification complete</span>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--content-text-dim)' }}>Detected Type</span>
              <Badge variant="default">{DOC_TYPE_LABELS[result.detectedType] ?? result.detectedType}</Badge>
            </div>
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--content-text-dim)' }}>Standards</span>
              {result.detectedStandards.map((s) => (
                <Badge key={s} variant="secondary">{s.replace('_', ' ').toUpperCase()}</Badge>
              ))}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase mb-1 block" style={{ color: 'var(--content-text-dim)' }}>
                Clause References ({result.clauses.length})
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {result.clauses.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5">
                      {c.standard.replace('_', ' ')} {c.clause}
                    </Badge>
                    <span className="text-xs line-clamp-2" style={{ color: 'var(--content-text-muted)' }}>{c.excerpt}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--content-text-dim)' }}>
                      {Math.round(c.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={reset}>Upload Another</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save to Document Studio'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
