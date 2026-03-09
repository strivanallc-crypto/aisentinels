'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  AlertCircle,
  Sparkles,
  Upload,
  ChevronRight,
  Search,
} from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocType, DocStatus } from '@/lib/types';
import {
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  DOC_STATUS_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { AiGenerateWizard } from '@/components/document-studio/ai-generate-wizard';
import { UploadClassifyModal } from '@/components/document-studio/upload-classify-modal';
import { BulkUploadModal } from '@/components/document-studio/bulk-upload-modal';

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

const STATUS_TABS: { value: DocStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

interface CreateForm {
  title: string;
  docType: DocType;
  content: string;
}

const EMPTY_FORM: CreateForm = { title: '', docType: 'procedure', content: '' };

export default function DocumentStudioPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DocStatus | 'all'>('all');
  const [search, setSearch] = useState('');

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
        title: form.title.trim(),
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

  const filtered = documents.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.docType.includes(q);
    }
    return true;
  });

  const statusCounts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SentinelAvatar sentinelId="doki" size={36} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              ISO Platform › Document Studio
            </p>
            <h1 className="mt-0.5 text-2xl font-bold">Document Studio</h1>
            <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
              Controlled document lifecycle — ISO 9001 Clause 7.5
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Bulk Import
          </Button>
          <Button variant="outline" onClick={() => setShowUpload(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Upload
          </Button>
          <Button variant="outline" onClick={() => setShowAiWizard(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            AI Generate
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Document
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Status tabs + Search ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? documents.length : (statusCounts[tab.value] ?? 0);
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300 font-medium'
                    : 'hover:bg-white/5'
                }`}
                style={!active ? { color: 'var(--content-text-dim)' } : undefined}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--content-text-dim)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-white/20 w-60"
            style={{ color: 'var(--content-text)' }}
          />
        </div>
      </div>

      {/* ── Table / Loading / Empty ── */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
              <SentinelAvatar sentinelId="doki" size={32} />
            </div>
            <div>
              <p className="font-semibold">
                {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
              </p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                {documents.length === 0
                  ? 'Create your first controlled document or let Doki generate one'
                  : 'Try adjusting your filters'}
              </p>
            </div>
            {documents.length === 0 && (
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={() => setShowAiWizard(true)}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> AI Generate
                </Button>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> New Document
                </Button>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Title', 'Type', 'Standards', 'Version', 'Status', 'Updated'].map((h) => (
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
              {filtered.map((doc, i) => (
                <tr
                  key={doc.id}
                  onClick={() => router.push(`/document-studio/${doc.id}`)}
                  className="cursor-pointer transition-colors hover:bg-white/5"
                  style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-indigo-400" />
                      <span className="font-medium">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--content-text-muted)' }}>
                    {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {doc.standards.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {s.replace('iso_', '').replace(/(\d)/, ' $1')}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-400">
                      v{doc.version}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={DOC_STATUS_VARIANT[doc.status]}>
                      {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--content-text-dim)' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Document Modal ── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New Document"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Document Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Supplier Qualification Procedure"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.docType}
              onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value as DocType }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            >
              {DOC_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Content <span className="font-normal" style={{ color: 'var(--content-text-dim)' }}>(optional)</span>
            </label>
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Enter document content or leave blank to add later…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create Document'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── AI Generate Wizard ── */}
      <AiGenerateWizard
        open={showAiWizard}
        onOpenChange={setShowAiWizard}
        onCreated={load}
      />

      {/* ── Upload & Classify Modal ── */}
      <UploadClassifyModal
        open={showUpload}
        onOpenChange={setShowUpload}
        onCreated={load}
      />

      {/* ── Bulk Upload Modal ── */}
      <BulkUploadModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onComplete={() => {
          setShowBulk(false);
          load();
        }}
      />
    </div>
  );
}
