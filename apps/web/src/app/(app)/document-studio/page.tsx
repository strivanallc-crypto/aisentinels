'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Upload, Sparkles, Plus, ArrowUpRight } from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocType, DocStatus } from '@/lib/types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  SentinelPageHero,
  PrimaryButton,
  SecondaryButton,
  SadewaEmptyState,
  SectionLabel,
  ContentCard,
  PageSkeleton,
} from '@/components/ui/sentinel-page-hero';
import { AiGenerateWizard } from '@/components/document-studio/ai-generate-wizard';
import { UploadClassifyModal } from '@/components/document-studio/upload-classify-modal';
import { BulkUploadModal } from '@/components/document-studio/bulk-upload-modal';

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  review: '#F59E0B',
  approved: '#22C55E',
  published: '#3B82F6',
  archived: '#4b5563',
};

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
  const [showCreate, setShowCreate] = useState(false);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list();
      const data = res.data;
      setDocuments(Array.isArray(data) ? data : ((data as Record<string, unknown>)?.documents as Document[] ?? []));
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await documentsApi.create({ title: form.title.trim(), docType: form.docType, content: form.content.trim() || undefined });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const filtered = documents.filter((doc) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return doc.title.toLowerCase().includes(q) || doc.docType.includes(q);
  });

  /* Stats for hero */
  const totalCount    = documents.length;
  const approvedCount = documents.filter((d) => d.status === 'approved' || d.status === 'published').length;
  const draftCount    = documents.filter((d) => d.status === 'draft').length;

  return (
    <div className="p-6 max-w-[1280px]">
      {/* ── Hero ── */}
      <SentinelPageHero
        sectionLabel="DOCUMENT STUDIO"
        title="Generate. Review. Approve."
        subtitle="Doki automates ISO document creation across all three standards simultaneously."
        sentinelColor="#6366F1"
        stats={
          loading
            ? undefined
            : [
                { value: String(totalCount), label: 'Documents' },
                { value: String(approvedCount), label: 'Approved' },
                { value: String(draftCount), label: 'Drafts' },
              ]
        }
      />

      {/* ── Section label + actions ── */}
      <div className="flex items-center justify-between mb-6">
        <SectionLabel>ALL DOCUMENTS</SectionLabel>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#4b5563' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>
          <SecondaryButton onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" /> Upload Document
          </SecondaryButton>
          <PrimaryButton onClick={() => setShowAiWizard(true)}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </PrimaryButton>
        </div>
      </div>

      {/* ── Content ── */}
      <ContentCard>
        {loading ? (
          <PageSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            description={
              documents.length === 0
                ? 'Upload your first ISO document to get started.'
                : 'Try adjusting your search query.'
            }
            action={
              documents.length === 0 ? (
                <PrimaryButton onClick={() => setShowAiWizard(true)}>
                  <Sparkles className="h-4 w-4" /> Generate with AI
                </PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            {filtered.map((doc, i) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/document-studio/${doc.id}`)}
                className="flex items-center gap-4 px-4 py-4 cursor-pointer transition-colors hover:bg-white/5"
              >
                {/* Number */}
                <span
                  className="text-[12px] font-semibold font-heading w-8 flex-shrink-0"
                  style={{ color: 'rgba(255,255,255,0.15)' }}
                >
                  /{String(i + 1).padStart(2, '0')}
                </span>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{doc.title}</p>
                  <p className="text-[11px]" style={{ color: '#6b7280' }}>
                    {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                  </p>
                </div>

                {/* Standards */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {(doc.standards ?? []).slice(0, 2).map((s) => (
                    <span
                      key={s}
                      className="rounded px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
                    >
                      {s.replace('iso_', 'ISO ').toUpperCase()}
                    </span>
                  ))}
                </div>

                {/* Status */}
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                  style={{
                    color: STATUS_COLORS[doc.status] ?? '#6b7280',
                    background: `${STATUS_COLORS[doc.status] ?? '#6b7280'}1a`,
                  }}
                >
                  {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                </span>

                {/* Date */}
                <span className="text-[12px] flex-shrink-0 w-20 text-right" style={{ color: '#6b7280' }}>
                  {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>

                <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#4b5563' }} />
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* ── Modals (existing components) ── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New Document"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Supplier Qualification Procedure"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
              style={{ color: '#fff' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Type</label>
            <select
              required
              value={form.docType}
              onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value as DocType }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: '#fff' }}
            >
              {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Content <span style={{ color: '#4b5563' }}>(optional)</span></label>
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Enter content or leave blank..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: '#fff' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Document'}</Button>
          </div>
        </form>
      </Modal>

      <AiGenerateWizard open={showAiWizard} onOpenChange={setShowAiWizard} onCreated={load} />
      <UploadClassifyModal open={showUpload} onOpenChange={setShowUpload} onCreated={load} />
      <BulkUploadModal open={showBulk} onClose={() => setShowBulk(false)} onComplete={() => { setShowBulk(false); load(); }} />
    </div>
  );
}
