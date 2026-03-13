'use client';

import { X } from 'lucide-react';
import { CATEGORY_ISO_MAP, STATUS_CONFIG } from './vault-constants';
import type { EnrichedRecord } from './vault-utils';

interface EvidencePresenterProps {
  record: EnrichedRecord;
  open: boolean;
  onClose: () => void;
}

export function EvidencePresenter({ record, open, onClose }: EvidencePresenterProps) {
  if (!open) return null;

  const r = record;
  const statusCfg = STATUS_CONFIG[r.derivedStatus];
  const isoClauses = CATEGORY_ISO_MAP[r.category] ?? [];
  const docId = r.id.length > 12 ? `${r.id.slice(0, 12)}…` : r.id;

  const retentionExpiry = r.retentionExpiresAt
    ? new Date(r.retentionExpiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  const approvedDate = new Date(r.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <h2 className="text-sm font-semibold font-heading truncate flex-1" style={{ color: 'var(--text)' }}>
          {r.title}
        </h2>
        <span className="text-[11px] font-mono" style={{ color: 'var(--content-text-dim)' }}>
          Doc ID: {docId}
        </span>
        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ color: statusCfg.color, background: statusCfg.bgColor }}
        >
          {statusCfg.label}
        </span>
        {isoClauses.map((iso) => (
          <span
            key={iso}
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ color: '#6366F1', background: '#6366F11a' }}
          >
            {iso}
          </span>
        ))}
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
          style={{ color: 'var(--muted)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center — content */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center">
          <div
            className="w-full max-w-3xl rounded-2xl p-8"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {r.contentText ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                {r.contentText}
              </div>
            ) : (
              <p className="text-sm italic text-center py-12" style={{ color: 'var(--muted)' }}>
                No content available for this record.
              </p>
            )}
          </div>
        </div>

        {/* Right panel — metadata */}
        <div
          className="w-[200px] flex-shrink-0 overflow-y-auto p-4 flex flex-col gap-5"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              ISO Clauses
            </p>
            <div className="flex flex-col gap-1">
              {isoClauses.map((iso) => (
                <span key={iso} className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
                  {iso}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
              Approved Date
            </p>
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>{approvedDate}</span>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
              Version
            </p>
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>1.0</span>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
              Retention
            </p>
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>
              {r.retentionYears} year{r.retentionYears !== 1 ? 's' : ''}
            </span>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--content-text-dim)' }}>
              Expires: {retentionExpiry}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom watermark */}
      <div
        className="flex-shrink-0 py-2 text-center text-[11px]"
        style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
      >
        Prepared with AI Sentinels — aisentinels.io
      </div>
    </div>
  );
}
