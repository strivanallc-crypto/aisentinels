'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, AlertCircle, ChevronRight } from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocType } from '@/lib/types';
import {
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  DOC_STATUS_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

interface CreateForm {
  title: string;
  docType: DocType;
  content: string;
}

const EMPTY_FORM: CreateForm = { title: '', docType: 'procedure', content: '' };

export default function DocumentStudioPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsApi.list();
      setDocuments(res.data as Document[]);
    } catch {
      setError('Failed to load documents. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.docType) return;
    setSaving(true);
    try {
      await documentsApi.create({
        title:   form.title.trim(),
        docType: form.docType,
        content: form.content.trim() || undefined,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setError('Failed to create document.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    setSubmitting(id);
    try {
      await documentsApi.submit(id, []);
      await load();
    } catch {
      setError('Failed to submit document for approval.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Document Studio
          </p>
          <h1 className="mt-1 text-2xl font-bold">Document Studio</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Controlled document lifecycle — ISO 9001 Clause 7.5
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Document
        </Button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={load}
            className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Table / Loading / Empty ───────────────────────────────── */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <FileText className="h-7 w-7 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold">No documents yet</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                Create your first controlled document
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="mt-1">
              <Plus className="mr-1.5 h-4 w-4" /> New Document
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Title', 'Type', 'Version', 'Status', 'Updated', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--content-text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => (
                <tr
                  key={doc.id}
                  className="transition-colors hover:bg-gray-50"
                  style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />
                      <span className="font-medium">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--content-text-muted)' }}>
                    {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      v{doc.version}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={DOC_STATUS_VARIANT[doc.status]}>
                      {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {doc.status === 'draft' && (
                      <button
                        onClick={() => handleSubmitForApproval(doc.id)}
                        disabled={submitting === doc.id}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                      >
                        {submitting === doc.id ? 'Submitting…' : 'Submit'}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Document Modal ─────────────────────────────────── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New Document"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Document Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Supplier Qualification Procedure"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.docType}
              onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value as DocType }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {DOC_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Content{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Enter document content or leave blank to add later…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create Document'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
