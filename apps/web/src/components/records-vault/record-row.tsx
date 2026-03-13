'use client';

import {
  Lock,
  Unlock,
  CheckCircle2,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  Circle,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RECORD_CATEGORY_LABELS, RECORD_CATEGORY_VARIANT } from '@/lib/types';
import { STATUS_CONFIG } from './vault-constants';
import type { EnrichedRecord } from './vault-utils';

const STATUS_ICON_MAP = {
  lock: Lock,
  'alert-triangle': AlertTriangle,
  'check-circle-2': CheckCircle2,
  circle: Circle,
} as const;

interface RecordRowProps {
  record: EnrichedRecord;
  index: number;
  selected: boolean;
  verifying: boolean;
  evidenceMode: boolean;
  onSelect: () => void;
  onVerify: () => void;
  onHold: () => void;
  onReleaseHold: () => void;
  onPresent: () => void;
}

export function RecordRow({
  record,
  index,
  selected,
  verifying,
  evidenceMode,
  onSelect,
  onVerify,
  onHold,
  onReleaseHold,
  onPresent,
}: RecordRowProps) {
  const r = record;
  const statusCfg = STATUS_CONFIG[r.derivedStatus];
  const StatusIcon = STATUS_ICON_MAP[statusCfg.iconName];

  return (
    <div
      className="flex items-center gap-4 px-4 py-4 transition-all duration-200 hover:pl-5 group cursor-pointer"
      style={{
        borderLeft: selected ? '2px solid #6366F1' : '2px solid transparent',
        background: selected ? 'var(--row-hover)' : undefined,
      }}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      tabIndex={0}
    >
      {/* Row number */}
      <span
        className="text-[12px] font-semibold font-heading w-8 flex-shrink-0 tabular-nums transition-colors group-hover:opacity-60"
        style={{ color: 'var(--row-number)' }}
      >
        /{String(index + 1).padStart(2, '0')}
      </span>

      {/* Title + category */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text)' }}>{r.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant={RECORD_CATEGORY_VARIANT[r.category]} className="text-[10px]">
            {RECORD_CATEGORY_LABELS[r.category]}
          </Badge>
          {r.isoStandards.map((iso) => (
            <span key={iso} className="text-[10px] font-medium" style={{ color: 'var(--content-text-dim)' }}>
              {iso}
            </span>
          ))}
        </div>
      </div>

      {/* Status badge */}
      <span
        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0"
        style={{ color: statusCfg.color, background: statusCfg.bgColor }}
      >
        <StatusIcon className="h-3 w-3" />
        {statusCfg.label}
      </span>

      {/* Actions (normal mode) or Present button (evidence mode) */}
      {evidenceMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onPresent(); }}
          className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors hover:opacity-80 flex-shrink-0"
          style={{ color: '#6366F1', background: '#6366F11a' }}
        >
          <Eye className="h-3 w-3" /> Present
        </button>
      ) : (
        <>
          {/* Legal Hold */}
          {r.legalHold ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onReleaseHold(); }}
                className="rounded p-0.5 hover:bg-white/10 transition-colors"
                title="Release hold"
                style={{ color: 'var(--muted)' }}
              >
                <Unlock className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onHold(); }}
              className="flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 hover:bg-white/5 transition-colors flex-shrink-0"
              style={{ color: 'var(--muted)' }}
            >
              <Lock className="h-3 w-3" /> Hold
            </button>
          )}

          {/* Integrity verify */}
          {r.integrityVerifiedAt === null || r.integrityVerifiedAt === undefined ? (
            <button
              onClick={(e) => { e.stopPropagation(); onVerify(); }}
              disabled={verifying}
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80 disabled:opacity-50 flex-shrink-0"
              style={{ color: '#F59E0B', background: '#F59E0B1a' }}
            >
              {verifying ? <Clock className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              {verifying ? 'Checking...' : 'Verify'}
            </button>
          ) : null}
        </>
      )}

      {/* Detail arrow */}
      <ArrowUpRight
        className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        style={{ color: 'var(--content-text-dim)' }}
      />
    </div>
  );
}
