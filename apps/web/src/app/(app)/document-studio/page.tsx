'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocType, IsoStandard } from '@/lib/types';
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
import { BulkUploadModal } from '@/components/document-studio/bulk-upload-modal';

/* ── Constants ─────────────────────────────────────────────── */

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

const STANDARD_OPTIONS: { value: IsoStandard; label: string; color: string }[] = [
  { value: 'iso_9001', label: 'ISO 9001', color: '#3B82F6' },
  { value: 'iso_14001', label: 'ISO 14001', color: '#22C55E' },
  { value: 'iso_45001', label: 'ISO 45001', color: '#F59E0B' },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  draft:     { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  review:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approved:  { color: '#c2fa69', bg: 'rgba(194,250,105,0.12)' },
  published: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  archived:  { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const STANDARD_PILL_STYLES: Record<string, { color: string; bg: string }> = {
  iso_9001:  { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  iso_14001: { color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  iso_45001: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
};

/* ── Page ──────────────────────────────────────────────────── */

export default function DocumentStudioPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocType | ''>('');
  const [filterStandard, setFilterStandard] = useState<IsoStandard | ''>('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list();
      const data = res.data;
      setDocuments(
        Array.isArray(data)
          ? data
          : ((data as Record<string, unknown>)?.documents as Document[] ?? []),
      );
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await documentsApi.update(id, { status: 'archived' });
      await load();
    } catch {
      /* toast handled by interceptor */
    } finally {
      setDeleting(null);
    }
  };

  /* ── Filtering ── */
  const filtered = documents.filter((doc) => {
    if (filterType && doc.docType !== filterType) return false;
    if (filterStandard && !(doc.standards ?? []).includes(filterStandard)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.docType.includes(q) ||
      doc.id.toLowerCase().includes(q)
    );
  });

  /* ── Stats ── */
  const totalCount = documents.length;
  const approvedCount = documents.filter(
    (d) => d.status === 'approved' || d.status === 'published',
  ).length;
  const draftCount = documents.filter((d) => d.status === 'draft').length;

  return (
    <div className="p-6 max-w-[1280px]">
      {/* ── Hero ── */}
      <SentinelPageHero
        sectionLabel="DOCUMENT STUDIO"
        title="Document Studio"
        subtitle="ISO-Compliant Documents, AI-Generated"
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

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-6">
        <SectionLabel>ALL DOCUMENTS</SectionLabel>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--content-text-dim)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* Filter by Type */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DocType | '')}
              className="appearance-none rounded-full border bg-transparent py-2 pl-4 pr-8 text-sm outline-none cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <option value="">All Types</option>
              {DOC_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--content-text-dim)' }}
            />
          </div>

          {/* Filter by Standard */}
          <div className="relative">
            <select
              value={filterStandard}
              onChange={(e) => setFilterStandard(e.target.value as IsoStandard | '')}
              className="appearance-none rounded-full border bg-transparent py-2 pl-4 pr-8 text-sm outline-none cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <option value="">All Standards</option>
              {STANDARD_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--content-text-dim)' }}
            />
          </div>

          <SecondaryButton onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4" /> Bulk Upload
          </SecondaryButton>
          <PrimaryButton onClick={() => router.push('/document-studio/new')}>
            <Plus className="h-4 w-4" /> New Document
          </PrimaryButton>
        </div>
      </div>

      {/* ── Documents Table ── */}
      <ContentCard>
        {loading ? (
          <PageSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={
              documents.length === 0
                ? 'No documents yet'
                : 'No matching documents'
            }
            description={
              documents.length === 0
                ? 'No documents yet. Create your first with Doki AI.'
                : 'Try adjusting your search or filter criteria.'
            }
            action={
              documents.length === 0 ? (
                <PrimaryButton onClick={() => router.push('/document-studio/new')}>
                  <Plus className="h-4 w-4" /> New Document
                </PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            {/* Table header */}
            <div
              className="grid items-center gap-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: '1fr 120px 100px 160px 100px 90px 80px',
                color: 'var(--muted)',
                borderBottom: '1px solid var(--row-divider)',
              }}
            >
              <span>Title</span>
              <span>Doc ID</span>
              <span>Type</span>
              <span>Standards</span>
              <span>Status</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Table rows */}
            <div className="divide-y" style={{ borderColor: 'var(--row-divider)' }}>
              {filtered.map((doc) => {
                const sts = STATUS_STYLES[doc.status] ?? STATUS_STYLES.draft;
                return (
                  <div
                    key={doc.id}
                    className="grid items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-white/[0.03] group"
                    style={{
                      gridTemplateColumns: '1fr 120px 100px 160px 100px 90px 80px',
                    }}
                    onClick={() => router.push(`/document-studio/${doc.id}`)}
                  >
                    {/* Title */}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {doc.title}
                      </p>
                    </div>

                    {/* Doc ID */}
                    <span
                      className="text-[11px] font-mono truncate"
                      style={{ color: 'var(--content-text-dim)' }}
                    >
                      {doc.id.slice(0, 8)}
                    </span>

                    {/* Type badge */}
                    <span
                      className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold w-fit"
                      style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}
                    >
                      {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                    </span>

                    {/* Standards pills */}
                    <div className="flex gap-1 flex-wrap">
                      {(doc.standards ?? []).map((s) => {
                        const ps = STANDARD_PILL_STYLES[s] ?? {
                          color: '#818CF8',
                          bg: 'rgba(99,102,241,0.10)',
                        };
                        return (
                          <span
                            key={s}
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: ps.bg, color: ps.color }}
                          >
                            {s.replace('iso_', 'ISO ')}
                          </span>
                        );
                      })}
                    </div>

                    {/* Status badge */}
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold w-fit"
                      style={{ color: sts.color, background: sts.bg }}
                    >
                      {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </span>

                    {/* Updated */}
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: 'var(--content-text-dim)' }}
                    >
                      {new Date(doc.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/document-studio/${doc.id}`);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                        title="Edit"
                        style={{ color: 'var(--content-text-muted)' }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        disabled={deleting === doc.id}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        title="Delete"
                        style={{ color: deleting === doc.id ? '#f87171' : 'var(--content-text-muted)' }}
                      >
                        {deleting === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ContentCard>

      {/* ── Modals ── */}
      <AiGenerateWizard open={showAiWizard} onOpenChange={setShowAiWizard} onCreated={load} />
      <BulkUploadModal open={showBulk} onClose={() => setShowBulk(false)} onComplete={() => { setShowBulk(false); load(); }} />
    </div>
  );
}
