'use client';

import { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Unlock,
  Clock,
  Calendar,
  User,
  Hash,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RECORD_CATEGORY_LABELS, RECORD_CATEGORY_VARIANT } from '@/lib/types';
import { auditTrailApi } from '@/lib/api';
import { CATEGORY_ISO_MAP, STATUS_CONFIG } from './vault-constants';
import type { EnrichedRecord } from './vault-utils';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — D4  Record Detail Panel (300px right overlay)                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface AuditEntry {
  id?: string;
  action?: string;
  description?: string;
  performedBy?: string;
  createdAt?: string;
  timestamp?: string;
}

interface RecordDetailPanelProps {
  record: EnrichedRecord;
  verifying: boolean;
  onClose: () => void;
  onVerify: () => void;
  onHold: () => void;
  onReleaseHold: () => void;
}

export function RecordDetailPanel({
  record,
  verifying,
  onClose,
  onVerify,
  onHold,
  onReleaseHold,
}: RecordDetailPanelProps) {
  const r = record;
  const statusCfg = STATUS_CONFIG[r.derivedStatus];
  const isoClauses = CATEGORY_ISO_MAP[r.category] ?? [];

  /* ── Audit Trail ─────────────────────────────────────────── */
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setAuditLoading(true);
    auditTrailApi
      .query({ entityId: r.id, entityType: 'record', limit: 20 })
      .then((res) => {
        if (!cancelled) {
          const data = res?.data;
          const entries = Array.isArray(data) ? data : (data?.entries ?? data?.items ?? []);
          setAuditEntries(entries as AuditEntry[]);
        }
      })
      .catch(() => {
        if (!cancelled) setAuditEntries([]);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => { cancelled = true; };
  }, [r.id]);

  /* ── Computed fields ─────────────────────────────────────── */
  const createdDate = new Date(r.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const updatedDate = new Date(r.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const hashTruncated = r.sha256Hash
    ? `${r.sha256Hash.slice(0, 16)}…${r.sha256Hash.slice(-8)}`
    : '—';
  const verifiedDate = r.integrityVerifiedAt
    ? new Date(r.integrityVerifiedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  // Retention days remaining
  const retentionDays = (() => {
    if (!r.retentionExpiresAt) return null;
    const diff = new Date(r.retentionExpiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  })();

  const retentionExpiry = r.retentionExpiresAt
    ? new Date(r.retentionExpiresAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : '—';

  return (
    <div
      className="absolute top-0 right-0 bottom-0 z-10 w-[300px] flex flex-col overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-semibold font-heading leading-snug"
            style={{ color: 'var(--text)' }}
          >
            {r.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors hover:bg-white/10 flex-shrink-0"
          style={{ color: 'var(--muted)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Scrollable content ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
        {/* Status section */}
        <div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ color: statusCfg.color, background: statusCfg.bgColor }}
          >
            {statusCfg.label}
          </span>
          {r.legalHold && r.legalHoldReason && (
            <div
              className="mt-2 rounded-lg p-2.5 text-[11px] leading-relaxed"
              style={{ background: '#EF44440d', color: '#EF4444' }}
            >
              <div className="flex items-center gap-1 font-semibold mb-1">
                <AlertCircle className="h-3 w-3" /> Legal Hold Reason
              </div>
              {r.legalHoldReason}
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div className="flex flex-col gap-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Record Info
          </p>

          <MetaRow icon={<FileText className="h-3 w-3" />} label="Category">
            <Badge variant={RECORD_CATEGORY_VARIANT[r.category]} className="text-[10px]">
              {RECORD_CATEGORY_LABELS[r.category]}
            </Badge>
          </MetaRow>

          <MetaRow icon={<ShieldCheck className="h-3 w-3" />} label="ISO Standard(s)">
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>
              {isoClauses.join(', ') || '—'}
            </span>
          </MetaRow>

          <MetaRow icon={<User className="h-3 w-3" />} label="Created By">
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>
              {r.createdBy || '—'}
            </span>
          </MetaRow>

          <MetaRow icon={<Calendar className="h-3 w-3" />} label="Created At">
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>{createdDate}</span>
          </MetaRow>

          <MetaRow icon={<Calendar className="h-3 w-3" />} label="Updated At">
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>{updatedDate}</span>
          </MetaRow>
        </div>

        {/* Integrity section */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Integrity
          </p>
          <MetaRow icon={<Hash className="h-3 w-3" />} label="SHA-256">
            <span
              className="text-[11px] font-mono break-all"
              style={{ color: 'var(--content-text-dim)' }}
            >
              {hashTruncated}
            </span>
          </MetaRow>
          {verifiedDate && (
            <MetaRow icon={<ShieldCheck className="h-3 w-3" />} label="Verified At">
              <span className="text-[11px]" style={{ color: '#22C55E' }}>
                {verifiedDate}
              </span>
            </MetaRow>
          )}
        </div>

        {/* Retention section */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Retention Schedule
          </p>
          <div className="text-[12px]" style={{ color: 'var(--text)' }}>
            {r.retentionYears} year{r.retentionYears !== 1 ? 's' : ''}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--content-text-dim)' }}>
            Expires: {retentionExpiry}
          </div>
          {retentionDays !== null && (
            <div
              className="text-[11px] font-medium"
              style={{ color: retentionDays > 0 ? 'var(--text)' : '#F59E0B' }}
            >
              {retentionDays > 0
                ? `${retentionDays} day${retentionDays !== 1 ? 's' : ''} remaining`
                : `${Math.abs(retentionDays)} day${Math.abs(retentionDays) !== 1 ? 's' : ''} overdue`}
            </div>
          )}
        </div>

        {/* Audit Trail section */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Audit Trail
          </p>
          {auditLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div
                className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent' }}
              />
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Loading...</span>
            </div>
          ) : auditEntries.length === 0 ? (
            <p className="text-[11px] italic py-2" style={{ color: 'var(--muted)' }}>
              No audit trail entries
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {auditEntries.map((entry, idx) => {
                const ts = entry.timestamp ?? entry.createdAt;
                const dateStr = ts
                  ? new Date(ts).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })
                  : '';
                return (
                  <div
                    key={entry.id ?? idx}
                    className="flex flex-col gap-0.5 rounded-lg p-2"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>
                      {entry.action ?? entry.description ?? 'Event'}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {entry.performedBy && `${entry.performedBy} · `}{dateStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Linked Records placeholder */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Linked Records
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--muted)' }}>
            No linked records — coming soon
          </p>
          {/* TODO(RV-2): Implement linked records when VaultRecord gains linkedRecords field */}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Quick Actions
          </p>
          <div className="flex flex-col gap-1.5">
            {/* Verify Integrity */}
            {(r.integrityVerifiedAt === null || r.integrityVerifiedAt === undefined) && (
              <button
                onClick={onVerify}
                disabled={verifying}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ color: '#F59E0B', background: '#F59E0B1a' }}
              >
                {verifying ? (
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {verifying ? 'Verifying...' : 'Verify Integrity'}
              </button>
            )}

            {/* Legal Hold */}
            {r.legalHold ? (
              <button
                onClick={onReleaseHold}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors hover:opacity-80"
                style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
              >
                <Unlock className="h-3.5 w-3.5" />
                Release Legal Hold
              </button>
            ) : (
              <button
                onClick={onHold}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors hover:opacity-80"
                style={{ color: '#EF4444', background: '#EF44441a' }}
              >
                <Lock className="h-3.5 w-3.5" />
                Apply Legal Hold
              </button>
            )}
          </div>
        </div>

        {/* TODO(RV-2): Archive and Dispose actions when endpoints available */}
      </div>
    </div>
  );
}

/* ── Helper: metadata row ──────────────────────────────────── */
function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--muted)' }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--muted)' }}>{label}</p>
        {children}
      </div>
    </div>
  );
}
