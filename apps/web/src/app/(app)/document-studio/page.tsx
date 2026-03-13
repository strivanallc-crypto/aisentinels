'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Upload, Sparkles, Plus, Pencil, Archive } from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocType } from '@/lib/types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/lib/types';
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

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  draft: { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  review: { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approved: { text: '#c2fa69', bg: 'rgba(194,250,105,0.12)' },
  published: { text: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  archived: { text: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const STANDARD_COLORS: Record<string, { text: string; bg: string }> = {
  iso_9001: { text: '#60a5fa', bg: 'rgba(59,130,246,0.10)' },
  iso_14001: { text: '#4ade80', bg: 'rgba(34,197,94,0.10)' },
  iso_45001: { text: '#fbbf24', bg: 'rgba(245,158,11,0.10)' },
};

export default function DocumentStudioPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [standardFilter, setStandardFilter] = useState<string>('');

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

  const filtered = documents.filter((doc) => {
    if (typeFilter && doc.docType !== typeFilter) return false;
    if (standardFilter && !(doc.standards ?? []).includes(standardFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.docType.includes(q) || doc.id.toLowerCase().includes(q);
    }
    return true;
  });

  const totalCount = documents.length;
  const approvedCount = documents.filter((d) => d.status === 'approved' || d.status === 'published').length;
  const draftCount = documents.filter((d) => d.status === 'draft').length;

  const handleArchive = async (docId: string) => {
    try {
      await documentsApi.update(docId, { status: 'archived' });
      await load();
    } catch { /* silent */ }
  };

  return (
    <div className="p-6 max-w-[1280px]">
      {/* Hero */}
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

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <SectionLabel>ALL DOCUMENTS</SectionLabel>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--content-text-dim)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-48 focus:border-white/20"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-full border bg-transparent py-2 px-3 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--content-surface)' }}
          >
            <option value="">All Types</option>
            {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          {/* Standard filter */}
          <select
            value={standardFilter}
            onChange={(e) => setStandardFilter(e.target.value)}
            className="rounded-full border bg-transparent py-2 px-3 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--content-surface)' }}
          >
            <option value="">All Standards</option>
            <option value="iso_9001">ISO 9001</option>
            <option value="iso_14001">ISO 14001</option>
            <option value="iso_45001">ISO 45001</option>
          </select>

          <SecondaryButton onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" /> Upload
          </SecondaryButton>
          <SecondaryButton onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4" /> Bulk Upload
          </SecondaryButton>
          <PrimaryButton onClick={() => setShowAiWizard(true)}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </PrimaryButton>
          <PrimaryButton onClick={() => router.push('/document-studio/new')}>
            <Plus className="h-4 w-4" /> New Document
          </PrimaryButton>
        </div>
      </div>

      {/* Table */}
      <ContentCard>
        {loading ? (
          <PageSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            description={
              documents.length === 0
                ? 'Create your first ISO document to get started.'
                : 'Try adjusting your search or filters.'
            }
            action={
              documents.length === 0 ? (
                <div className="flex gap-3">
                  <PrimaryButton onClick={() => setShowAiWizard(true)}>
                    <Sparkles className="h-4 w-4" /> Generate with AI
                  </PrimaryButton>
                  <SecondaryButton onClick={() => router.push('/document-studio/new')}>
                    <Plus className="h-4 w-4" /> Blank Document
                  </SecondaryButton>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--content-text-muted)', borderBottom: '1px solid var(--row-divider)' }}
                >
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 w-28">Doc ID</th>
                  <th className="px-4 py-3 w-32">Type</th>
                  <th className="px-4 py-3 w-36">Standards</th>
                  <th className="px-4 py-3 w-32">Status</th>
                  <th className="px-4 py-3 w-24">Updated</th>
                  <th className="px-4 py-3 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const sc = STATUS_COLORS[doc.status] ?? STATUS_COLORS.draft;
                  return (
                    <tr
                      key={doc.id}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: '1px solid var(--row-divider)' }}
                      onClick={() => router.push(`/document-studio/${doc.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[14px] truncate max-w-xs">{doc.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px]" style={{ color: 'var(--content-text-dim)' }}>
                          {doc.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}
                        >
                          {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(doc.standards ?? []).map((s) => {
                            const c = STANDARD_COLORS[s] ?? { text: '#818CF8', bg: 'rgba(99,102,241,0.10)' };
                            return (
                              <span
                                key={s}
                                className="rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: c.bg, color: c.text }}
                              >
                                {s.replace('iso_', 'ISO ').toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ color: sc.text, background: sc.bg }}
                        >
                          {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--content-text-dim)' }}>
                          {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/document-studio/${doc.id}`); }}
                            className="rounded p-1 hover:bg-white/10 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--content-text-dim)' }} />
                          </button>
                          {doc.status === 'draft' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArchive(doc.id); }}
                              className="rounded p-1 hover:bg-white/10 transition-colors"
                              title="Archive"
                            >
                              <Archive className="h-3.5 w-3.5" style={{ color: 'var(--content-text-dim)' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ContentCard>

      {/* Modals */}
      <AiGenerateWizard open={showAiWizard} onOpenChange={setShowAiWizard} onCreated={load} />
      <UploadClassifyModal open={showUpload} onOpenChange={setShowUpload} onCreated={load} />
      <BulkUploadModal open={showBulk} onClose={() => setShowBulk(false)} onComplete={() => { setShowBulk(false); load(); }} />
    </div>
  );
}
