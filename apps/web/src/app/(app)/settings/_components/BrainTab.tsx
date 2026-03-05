'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileUp,
  Loader2,
  Trash2,
  Brain,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { brainApi } from '@/lib/api';
import type { BrainDocument, BrainProcessingStatus } from '@/lib/types';
import { BRAIN_STATUS_LABELS, BRAIN_STATUS_VARIANT, DOC_CATEGORY_LABELS } from '@/lib/types';

const DOC_CATEGORIES = [
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'manual', label: 'Manual' },
  { value: 'form', label: 'Form' },
  { value: 'record', label: 'Record' },
  { value: 'external', label: 'External Reference' },
  { value: 'other', label: 'Other' },
];

const STANDARD_OPTIONS = [
  { value: '', label: 'None / General' },
  { value: 'ISO 9001', label: 'ISO 9001' },
  { value: 'ISO 14001', label: 'ISO 14001' },
  { value: 'ISO 45001', label: 'ISO 45001' },
];

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
const inputStyle = {
  background: '#1E293B',
  borderColor: 'rgba(255,255,255,0.07)',
  color: '#F9FAFB',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusDot(status: BrainProcessingStatus): string {
  switch (status) {
    case 'ready':    return 'bg-green-400';
    case 'chunking': return 'bg-amber-400 animate-pulse';
    case 'failed':   return 'bg-red-400';
    default:         return 'bg-gray-400';
  }
}

export function BrainTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<BrainDocument[]>([]);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('other');
  const [relatedStandard, setRelatedStandard] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'url' | 'upload' | 'process'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<BrainDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocuments = async () => {
    try {
      const { data } = await brainApi.listDocuments();
      setDocuments(data as BrainDocument[]);
    } catch {
      toast({ title: 'Failed to load documents', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Brain health summary
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);
  const readyDocs = documents.filter((d) => d.processingStatus === 'ready').length;
  const standards = [...new Set(documents.map((d) => d.relatedStandard).filter(Boolean))];

  const handleFile = (f: File) => {
    setFile(f);
    setCategory('other');
    setRelatedStandard('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      // Step 1: Get presigned URL
      setUploadStep('url');
      const { data } = await brainApi.getUploadUrl({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        docCategory: category,
        relatedStandard: relatedStandard || undefined,
      });
      const { uploadUrl, orgDocumentId } = data as { uploadUrl: string; orgDocumentId: string };

      // Step 2: Upload to S3 (raw axios, no JWT)
      setUploadStep('upload');
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      // Step 3: Trigger processing
      setUploadStep('process');
      await brainApi.process(orgDocumentId);

      toast({ title: `${file.name} uploaded & processing started`, variant: 'success' });
      setFile(null);
      setUploadStep('idle');
      await loadDocuments();
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
      setUploadStep('idle');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await brainApi.deleteDocument(deleteTarget.id);
      toast({ title: `${deleteTarget.fileName} deleted`, variant: 'info' });
      setDeleteTarget(null);
      await loadDocuments();
    } catch {
      toast({ title: 'Failed to delete document', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-20 w-full rounded-[10px]" />
        <Skeleton className="h-36 w-full rounded-[10px]" />
        <Skeleton className="h-48 w-full rounded-[10px]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Brain Health Card */}
      <div
        className="rounded-[10px] border p-4 flex items-center gap-4"
        style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <Brain className="h-8 w-8 text-indigo-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">Knowledge Base</span>
            {totalChunks === 0 ? (
              <Badge variant="warning">Empty</Badge>
            ) : (
              <Badge variant="success">{readyDocs} ready</Badge>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {totalChunks} chunk{totalChunks !== 1 && 's'} across {documents.length} document{documents.length !== 1 && 's'}
          </p>
          {standards.length > 0 && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {standards.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {totalChunks === 0 && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            Upload documents to build your knowledge base
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div
        className="rounded-[10px] border p-5"
        style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Upload Document
        </h3>

        {/* Drop area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors hover:border-indigo-400/40"
          style={{
            borderColor: file ? '#6366F140' : 'rgba(255,255,255,0.1)',
            background: file ? 'rgba(99,102,241,0.05)' : 'transparent',
          }}
        >
          {file ? (
            <>
              <FileUp className="h-7 w-7 text-indigo-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7 text-gray-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-300">
                  Drop a file or click to browse
                </p>
                <p className="text-xs text-gray-500">.pdf, .docx, .txt</p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.doc,.text,.md"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
            }}
          />
        </div>

        {/* Metadata form (after file selected) */}
        {file && !uploading && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Related Standard
                </label>
                <select
                  value={relatedStandard}
                  onChange={(e) => setRelatedStandard(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  {STANDARD_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpload}>
                <Upload className="mr-1.5 h-4 w-4" />
                Upload & Process
              </Button>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="mt-4 space-y-2">
            <ProgressStep
              step="url"
              label="Getting upload URL"
              current={uploadStep}
              order={['url', 'upload', 'process']}
            />
            <ProgressStep
              step="upload"
              label="Uploading to storage"
              current={uploadStep}
              order={['url', 'upload', 'process']}
            />
            <ProgressStep
              step="process"
              label="Starting processing"
              current={uploadStep}
              order={['url', 'upload', 'process']}
            />
          </div>
        )}
      </div>

      {/* Documents Table */}
      {documents.length > 0 && (
        <div
          className="rounded-[10px] border overflow-hidden"
          style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Documents ({documents.length})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  File
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Standard
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Chunks
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Uploaded
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-white font-medium truncate max-w-[200px]">
                        {doc.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {DOC_CATEGORY_LABELS[doc.docCategory] ?? doc.docCategory}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {doc.relatedStandard ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{doc.chunkCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(doc.processingStatus)}`} />
                      <Badge variant={BRAIN_STATUS_VARIANT[doc.processingStatus]}>
                        {BRAIN_STATUS_LABELS[doc.processingStatus]}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {formatDate(doc.uploadedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Document"
        className="max-w-sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{deleteTarget?.fileName}</strong>?
          This will remove the document and all its knowledge chunks.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Upload progress step indicator */
function ProgressStep({
  step,
  label,
  current,
  order,
}: {
  step: string;
  label: string;
  current: string;
  order: string[];
}) {
  const currentIdx = order.indexOf(current);
  const stepIdx = order.indexOf(step);
  const isDone = currentIdx > stepIdx;
  const isActive = current === step;

  return (
    <div className="flex items-center gap-2.5 text-sm">
      {isDone ? (
        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
      ) : isActive ? (
        <Loader2 className="h-4 w-4 text-indigo-400 animate-spin flex-shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-gray-600 flex-shrink-0" />
      )}
      <span className={isDone ? 'text-green-400' : isActive ? 'text-white' : 'text-gray-600'}>
        {label}
      </span>
    </div>
  );
}
