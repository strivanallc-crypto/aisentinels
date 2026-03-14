'use client';

import { X, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { Document, IsoStandard } from '@/lib/types';
import { DOC_STATUS_LABELS } from '@/lib/types';
import { ANNEX_SL_CLAUSES } from './annex-sl-clauses';
import { getDocsForCell, computeCellScore } from './coverage-utils';

const STANDARD_META: Record<string, { label: string; color: string }> = {
  iso_9001:  { label: 'ISO 9001', color: '#3B82F6' },
  iso_14001: { label: 'ISO 14001', color: '#22C55E' },
  iso_45001: { label: 'ISO 45001', color: '#F59E0B' },
};

interface CellDetailPanelProps {
  clauseId: string;
  standard: IsoStandard;
  documents: Document[];
  onClose: () => void;
  onFixWithAi: () => void;
}

export function CellDetailPanel({
  clauseId,
  standard,
  documents,
  onClose,
  onFixWithAi,
}: CellDetailPanelProps) {
  const clause = ANNEX_SL_CLAUSES.find((c) => c.id === clauseId);
  const meta = STANDARD_META[standard];
  const { approved, draft } = getDocsForCell(documents, clauseId, standard);
  const allDocs = [...approved, ...draft];
  const score = computeCellScore(documents, clauseId, standard);

  return (
    <div
      className="fixed top-0 right-0 z-50 h-full w-[280px] flex flex-col border-l shadow-2xl"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            Clause {clauseId}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {clause?.title ?? ''}
          </p>
          <span
            className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border"
            style={{
              color: meta?.color,
              backgroundColor: `${meta?.color}1a`,
              borderColor: `${meta?.color}40`,
            }}
          >
            {meta?.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-white/10 flex-shrink-0"
        >
          <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Documents section */}
        {allDocs.length > 0 ? (
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              / Documents ({allDocs.length})
            </p>
            <div className="space-y-2">
              {allDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <FileText
                      className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {doc.title}
                      </p>
                      <span
                        className="mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          background:
                            doc.status === 'approved' || doc.status === 'published'
                              ? 'rgba(194,250,105,0.1)'
                              : 'rgba(100,116,139,0.15)',
                          color:
                            doc.status === 'approved' || doc.status === 'published'
                              ? '#c2fa69'
                              : '#94a3b8',
                        }}
                      >
                        {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/document-studio/${doc.id}`}
                    className="mt-2 block rounded-md px-2 py-1 text-center text-[10px] font-semibold transition-colors hover:bg-white/10"
                    style={{
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertTriangle
              className="mx-auto h-6 w-6 mb-2"
              style={{ color: '#f87171' }}
            />
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              No documents cover this clause
            </p>
            <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
              Create a document or run AI gap analysis to get recommendations.
            </p>
          </div>
        )}

        {/* Create Document link */}
        <Link
          href={`/document-studio/new?clause=${encodeURIComponent(clauseId)}&standard=${encodeURIComponent(standard)}`}
          className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/5"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <FileText className="h-3.5 w-3.5" />
          Create Document
        </Link>

        {/* Fix with AI */}
        {score === 0 && (
          <button
            onClick={onFixWithAi}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all hover:scale-[1.02]"
            style={{
              background: '#c2fa69',
              color: '#0a0f1a',
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Fix with AI
          </button>
        )}
      </div>
    </div>
  );
}
