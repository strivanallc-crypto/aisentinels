'use client';

import { useState } from 'react';
import {
  Search,
  PanelLeftOpen,
  PanelLeftClose,
  Eye,
  EyeOff,
  Plus,
  Package,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { ContentCard, SadewaEmptyState, SectionLabel } from '@/components/ui/sentinel-page-hero';
import { ISO_GROUP_LABELS, CATEGORY_ISO_MAP } from './vault-constants';
import { RecordRow } from './record-row';
import type { EnrichedRecord } from './vault-utils';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — D3+D6  Center Records Table + Evidence Mode                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface RecordsTableProps {
  records: EnrichedRecord[];
  loading: boolean;
  selectedId: string | null;
  verifyingId: string | null;
  evidenceMode: boolean;
  navigatorOpen: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onToggleNavigator: () => void;
  onToggleEvidence: () => void;
  onSelect: (id: string) => void;
  onVerify: (id: string) => void;
  onHold: (id: string) => void;
  onReleaseHold: (id: string) => void;
  onPresent: (record: EnrichedRecord) => void;
  onCreateNew: () => void;
}

export function RecordsTable({
  records,
  loading,
  selectedId,
  verifyingId,
  evidenceMode,
  navigatorOpen,
  search,
  onSearchChange,
  onToggleNavigator,
  onToggleEvidence,
  onSelect,
  onVerify,
  onHold,
  onReleaseHold,
  onPresent,
  onCreateNew,
}: RecordsTableProps) {
  /* ── Export Package Modal state ─────────────────────────────── */
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());

  const openExport = () => {
    setExportSelected(new Set(records.map((r) => r.id)));
    setShowExport(true);
  };

  const toggleExportItem = (id: string) => {
    setExportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = () => {
    const selectedRecords = records.filter((r) => exportSelected.has(r.id));
    const pkg = {
      generatedAt: new Date().toISOString(),
      tenant: 'AI Sentinels',
      records: selectedRecords.map((r) => ({
        id: r.id,
        title: r.title,
        docId: r.id,
        category: r.category,
        isoStandard: (CATEGORY_ISO_MAP[r.category] ?? [])[0] ?? '',
        status: r.derivedStatus,
        retentionYears: r.retentionYears,
      })),
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AuditEvidencePackage_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  /* ── Evidence Mode grouping ────────────────────────────────── */
  const groupedByISO = (() => {
    if (!evidenceMode) return null;
    const groups = new Map<string, EnrichedRecord[]>();
    for (const r of records) {
      const iso = r.isoStandards[0] ?? 'Other';
      const list = groups.get(iso) ?? [];
      list.push(r);
      groups.set(iso, list);
    }
    // Sort groups by ISO key order
    const order = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 19011', 'Other'];
    return order
      .filter((k) => groups.has(k))
      .map((k) => ({ iso: k, label: ISO_GROUP_LABELS[k] ?? k, records: groups.get(k)! }));
  })();

  /* ── Render row helper ─────────────────────────────────────── */
  const renderRow = (r: EnrichedRecord, idx: number) => (
    <RecordRow
      key={r.id}
      record={r}
      index={idx}
      selected={selectedId === r.id}
      verifying={verifyingId === r.id}
      evidenceMode={evidenceMode}
      onSelect={() => onSelect(r.id)}
      onVerify={() => onVerify(r.id)}
      onHold={() => onHold(r.id)}
      onReleaseHold={() => onReleaseHold(r.id)}
      onPresent={() => onPresent(r)}
    />
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {/* Toggle navigator */}
        <button
          onClick={onToggleNavigator}
          className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
          style={{ color: 'var(--muted)' }}
          title={navigatorOpen ? 'Hide navigator' : 'Show navigator'}
        >
          {navigatorOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        {/* Search */}
        <div className="flex-1 relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: 'var(--muted)' }}
          />
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-1.5 text-sm outline-none"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--input-bg)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Evidence mode toggle */}
        <button
          onClick={onToggleEvidence}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
          style={{
            color: evidenceMode ? '#6366F1' : 'var(--muted)',
            background: evidenceMode ? '#6366F11a' : 'transparent',
            border: evidenceMode ? '1px solid #6366F133' : '1px solid transparent',
          }}
        >
          {evidenceMode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Evidence Mode
        </button>

        {/* Export package (evidence mode only) */}
        {evidenceMode && (
          <button
            onClick={openExport}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40"
            style={{ color: '#6366F1', background: '#6366F11a' }}
          >
            <Package className="h-3.5 w-3.5" />
            Export Package
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* New Record */}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.97]"
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            boxShadow: '0 2px 12px var(--accent-glow)',
          }}
        >
          <Plus className="h-4 w-4" />
          New Record
        </button>
      </div>

      {/* ── Records list ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6">
            <ContentCard>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl animate-shimmer"
                    style={{
                      background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
                      backgroundSize: '200% 100%',
                    }}
                  />
                ))}
              </div>
            </ContentCard>
          </div>
        ) : records.length === 0 ? (
          <SadewaEmptyState
            heading="No records found"
            description="Create your first record to start building your audit-ready evidence vault."
            action={
              <button
                onClick={onCreateNew}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02]"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                }}
              >
                <Plus className="h-4 w-4" />
                New Record
              </button>
            }
          />
        ) : evidenceMode && groupedByISO ? (
          /* ── Evidence Mode: grouped by ISO ──────────────────── */
          <div className="p-4 space-y-6">
            {groupedByISO.map((group) => (
              <div key={group.iso}>
                <div className="px-4 mb-2">
                  <SectionLabel>{group.label}</SectionLabel>
                </div>
                <ContentCard className="!p-0">
                  <div className="divide-y" style={{ borderColor: 'var(--row-divider)' } as React.CSSProperties}>
                    {group.records.map((r, idx) => renderRow(r, idx))}
                  </div>
                </ContentCard>
              </div>
            ))}
          </div>
        ) : (
          /* ── Normal Mode: flat list ─────────────────────────── */
          <div className="p-4">
            <ContentCard className="!p-0">
              {/* Column headers */}
              <div
                className="flex items-center gap-4 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted)', borderBottom: '1px solid var(--row-divider)' }}
              >
                <span className="w-8 flex-shrink-0">#</span>
                <span className="flex-1">Title</span>
                <span className="w-28 flex-shrink-0 text-center">Status</span>
                <span className="w-32 flex-shrink-0 text-center">Actions</span>
                <span className="w-4 flex-shrink-0" />
              </div>
              {/* Rows */}
              <div
                className="divide-y"
                style={{ borderColor: 'var(--row-divider)' } as React.CSSProperties}
              >
                {records.map((r, idx) => renderRow(r, idx))}
              </div>
            </ContentCard>
          </div>
        )}
      </div>

      {/* ── Export Package Modal ───────────────────────────────── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold font-heading" style={{ color: 'var(--text)' }}>
                Export Evidence Package
              </h3>
              <button
                onClick={() => setShowExport(false)}
                className="rounded-lg p-1 hover:bg-white/10 transition-colors"
                style={{ color: 'var(--muted)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Select the records to include in the evidence package.
            </p>

            <div
              className="max-h-60 overflow-y-auto divide-y rounded-lg border mb-4"
              style={{ borderColor: 'var(--border)' }}
            >
              {records.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggleExportItem(r.id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  {exportSelected.has(r.id) ? (
                    <CheckSquare className="h-4 w-4 flex-shrink-0" style={{ color: '#6366F1' }} />
                  ) : (
                    <Square className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                  )}
                  <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                    {r.title}
                  </span>
                  <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: 'var(--content-text-dim)' }}>
                    {(CATEGORY_ISO_MAP[r.category] ?? [])[0] ?? ''}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {exportSelected.size} of {records.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExport(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={exportSelected.size === 0}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)',
                  }}
                >
                  <Package className="h-4 w-4" />
                  Generate Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
