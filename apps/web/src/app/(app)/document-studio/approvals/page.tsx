'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Eye } from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document } from '@/lib/types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/lib/types';
import {
  SentinelPageHero,
  SadewaEmptyState,
  SectionLabel,
  ContentCard,
  PageSkeleton,
} from '@/components/ui/sentinel-page-hero';

const STANDARD_COLORS: Record<string, { text: string; bg: string }> = {
  iso_9001: { text: '#60a5fa', bg: 'rgba(59,130,246,0.10)' },
  iso_14001: { text: '#4ade80', bg: 'rgba(34,197,94,0.10)' },
  iso_45001: { text: '#fbbf24', bg: 'rgba(245,158,11,0.10)' },
};

export default function ApprovalsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list({ status: 'review' });
      const data = res.data;
      setDocuments(
        Array.isArray(data)
          ? data
          : ((data as Record<string, unknown>)?.documents as Document[] ?? [])
      );
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-[1280px]">
      {/* Hero */}
      <SentinelPageHero
        sectionLabel="APPROVALS"
        title="Review & Approve"
        subtitle="ISO 7.5.2 — Documents awaiting approval decision."
        sentinelColor="#6366F1"
        stats={
          loading
            ? undefined
            : [
                { value: String(documents.length), label: 'Pending' },
              ]
        }
      />

      {/* Content */}
      <div className="mb-4">
        <SectionLabel>PENDING APPROVALS</SectionLabel>
      </div>

      <ContentCard>
        {loading ? (
          <PageSkeleton rows={4} />
        ) : documents.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading="No documents awaiting approval"
            description="When documents are submitted for approval, they will appear here."
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
                  <th className="px-4 py-3 w-32">Type</th>
                  <th className="px-4 py-3 w-36">Standards</th>
                  <th className="px-4 py-3 w-32">Status</th>
                  <th className="px-4 py-3 w-24">Updated</th>
                  <th className="px-4 py-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
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
                        style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.12)' }}
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
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/document-studio/${doc.id}`); }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors opacity-0 group-hover:opacity-100"
                        style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
