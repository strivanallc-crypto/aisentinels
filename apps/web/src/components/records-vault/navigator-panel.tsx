'use client';

import { ChevronLeft, Search, X } from 'lucide-react';
import { RECORD_CATEGORY_LABELS } from '@/lib/types';
import type { RecordCategory } from '@/lib/types';
import { STATUS_CONFIG } from './vault-constants';
import type { DerivedStatus } from './vault-constants';
import type { CategoryBreakdown, KpiStats } from './vault-utils';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — D2+D5  Navigator Panel + Auditor Quick Retrieve                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface NavigatorPanelProps {
  categoryBreakdown: CategoryBreakdown[];
  kpiStats: KpiStats;
  categoryFilter: RecordCategory | null;
  statusFilter: DerivedStatus | null;
  clauseSearch: string;
  onCategoryFilter: (cat: RecordCategory | null) => void;
  onStatusFilter: (status: DerivedStatus | null) => void;
  onClauseSearch: (v: string) => void;
  onClose: () => void;
}

const STATUS_FILTER_ORDER: DerivedStatus[] = ['active', 'verified', 'legal_hold', 'due_disposal'];

export function NavigatorPanel({
  categoryBreakdown,
  kpiStats,
  categoryFilter,
  statusFilter,
  clauseSearch,
  onCategoryFilter,
  onStatusFilter,
  onClauseSearch,
  onClose,
}: NavigatorPanelProps) {
  const hasFilters = categoryFilter !== null || statusFilter !== null || clauseSearch.trim() !== '';

  const statusCounts: Record<DerivedStatus, number> = {
    active: kpiStats.total - kpiStats.verified - kpiStats.legalHold - kpiStats.dueDisposal,
    verified: kpiStats.verified,
    legal_hold: kpiStats.legalHold,
    due_disposal: kpiStats.dueDisposal,
  };

  return (
    <div
      className="w-[240px] flex-shrink-0 flex flex-col overflow-hidden"
      style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--muted)' }}
        >
          / Navigator
        </p>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors hover:bg-white/10"
          style={{ color: 'var(--muted)' }}
          title="Close navigator"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">
        {/* ── D5: Clause Quick Retrieve ─────────────────────── */}
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Quick Retrieve
          </p>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3"
              style={{ color: 'var(--muted)' }}
            />
            <input
              type="text"
              placeholder="e.g. 7.1.5 or clause..."
              value={clauseSearch}
              onChange={(e) => onClauseSearch(e.target.value)}
              className="w-full rounded-lg border pl-8 pr-3 py-1.5 text-[12px] outline-none"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--text)',
              }}
            />
          </div>
          {clauseSearch.trim() && (
            <div
              className="mt-1.5 flex items-center gap-1 text-[10px] font-medium"
              style={{ color: '#6366F1' }}
            >
              <span>Filtering by: {clauseSearch}</span>
              <button onClick={() => onClauseSearch('')} className="hover:opacity-60">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* ── Categories ──────────────────────────────────── */}
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Categories
          </p>
          <div className="flex flex-col gap-0.5">
            {/* All Records */}
            <button
              onClick={() => onCategoryFilter(null)}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors text-left"
              style={{
                color: categoryFilter === null ? '#6366F1' : 'var(--text)',
                background: categoryFilter === null ? '#6366F10d' : 'transparent',
              }}
            >
              <span>All Records</span>
              <span
                className="text-[10px] tabular-nums rounded-full px-2 py-0.5 font-semibold"
                style={{
                  color: 'var(--muted)',
                  background: 'var(--surface-2)',
                }}
              >
                {kpiStats.total}
              </span>
            </button>

            {categoryBreakdown.map(({ category, count }) => (
              <button
                key={category}
                onClick={() => onCategoryFilter(categoryFilter === category ? null : category)}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors text-left"
                style={{
                  color: categoryFilter === category ? '#6366F1' : 'var(--text)',
                  background: categoryFilter === category ? '#6366F10d' : 'transparent',
                }}
              >
                <span>{RECORD_CATEGORY_LABELS[category]}</span>
                <span
                  className="text-[10px] tabular-nums rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    color: 'var(--muted)',
                    background: 'var(--surface-2)',
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Status Filters ──────────────────────────────── */}
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Status
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_ORDER.map((status) => {
              const cfg = STATUS_CONFIG[status];
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => onStatusFilter(isActive ? null : status)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors"
                  style={{
                    color: isActive ? cfg.color : 'var(--muted)',
                    background: isActive ? cfg.bgColor : 'var(--surface-2)',
                    border: isActive ? `1px solid ${cfg.color}33` : '1px solid transparent',
                  }}
                >
                  {cfg.label}
                  <span className="tabular-nums">{statusCounts[status]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Clear Filters ────────────────────────────────── */}
        {hasFilters && (
          <button
            onClick={() => {
              onCategoryFilter(null);
              onStatusFilter(null);
              onClauseSearch('');
            }}
            className="text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: '#6366F1' }}
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
