'use client';

/**
 * VersionHistoryPanel — Right-side overlay panel showing document version info.
 *
 * Currently displays only the current version since no backend version
 * endpoint exists yet. A placeholder note explains full history is planned.
 */

import { X, Clock, FileText, Info } from 'lucide-react';
import type { Document } from '@/lib/types';
import { DOC_STATUS_LABELS } from '@/lib/types';

/* ── Status badge colors (matches editor page) ───────────────────────── */
const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  draft: { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  review: { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approved: { text: '#c2fa69', bg: 'rgba(194,250,105,0.12)' },
  published: { text: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  archived: { text: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

interface VersionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  doc: Document;
}

export function VersionHistoryPanel({ open, onClose, doc }: VersionHistoryPanelProps) {
  if (!open) return null;

  const sc = STATUS_COLORS[doc.status] ?? STATUS_COLORS.draft;

  const fmtDate = (d: string | undefined | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="absolute top-0 right-0 bottom-0 z-10 flex flex-col border-l overflow-y-auto"
      style={{
        width: 280,
        background: 'var(--content-surface)',
        borderColor: 'var(--content-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--content-border)' }}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" style={{ color: '#6366F1' }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: 'var(--content-text-muted)' }}
          >
            Version History
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-white/10"
          style={{ color: 'var(--content-text-dim)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Current Version */}
      <div className="px-4 py-4 space-y-4">
        <div
          className="rounded-xl p-3 space-y-3"
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.12)',
          }}
        >
          {/* Version header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" style={{ color: '#6366F1' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>
                v{doc.version}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: '#6366F1', background: 'rgba(99,102,241,0.15)' }}
              >
                Current
              </span>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: sc.text, background: sc.bg }}
            >
              {DOC_STATUS_LABELS[doc.status] ?? doc.status}
            </span>
          </div>

          {/* Metadata */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--content-text-dim)' }}>Created</span>
              <span style={{ color: 'var(--content-text-muted)' }}>{fmtDate(doc.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--content-text-dim)' }}>Last Modified</span>
              <span style={{ color: 'var(--content-text-muted)' }}>{fmtDate(doc.updatedAt)}</span>
            </div>
            {doc.approvedAt && (
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--content-text-dim)' }}>Approved</span>
                <span style={{ color: 'var(--content-text-muted)' }}>{fmtDate(doc.approvedAt)}</span>
              </div>
            )}
            {doc.approvedBy && (
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--content-text-dim)' }}>Approved By</span>
                <span
                  className="truncate max-w-[140px]"
                  style={{ color: 'var(--content-text-muted)' }}
                  title={doc.approvedBy}
                >
                  {doc.approvedBy}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info banner — future release */}
        <div
          className="flex items-start gap-2.5 rounded-xl p-3 text-[11px]"
          style={{
            background: 'rgba(99,102,241,0.04)',
            border: '1px solid rgba(99,102,241,0.08)',
            color: 'var(--content-text-dim)',
          }}
        >
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
          <span className="leading-relaxed">
            Full version history with diff comparison will be available in the next release.
          </span>
        </div>
      </div>
    </div>
  );
}
