'use client';

import { useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import type { IsoStandard } from '@/lib/types';
import { ISO_STANDARD_LABELS } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────
export type CellStatus = 'audited' | 'documented' | 'partial' | 'gap' | 'critical_gap' | 'na';

export interface HeatmapCell {
  clause: string;
  standard: IsoStandard;
  score: number;       // 0–100
  status: CellStatus;
  label?: string;      // tooltip detail
}

export interface ComplianceHeatmapProps {
  cells: HeatmapCell[];
  standards: IsoStandard[];
  onCellClick?: (clause: string, standard: IsoStandard) => void;
}

// ── Annex SL structure (matches compliance-matrix page) ────────
const ANNEX_SL_CLAUSES: { id: string; title: string; subclauses: string[] }[] = [
  { id: '4', title: 'Context of the Organisation', subclauses: ['4.1', '4.2', '4.3', '4.4'] },
  { id: '5', title: 'Leadership',                  subclauses: ['5.1', '5.2', '5.3'] },
  { id: '6', title: 'Planning',                    subclauses: ['6.1', '6.2', '6.3'] },
  { id: '7', title: 'Support',                     subclauses: ['7.1', '7.2', '7.3', '7.4', '7.5'] },
  { id: '8', title: 'Operation',                   subclauses: ['8.1', '8.2'] },
  { id: '9', title: 'Performance Evaluation',      subclauses: ['9.1', '9.2', '9.3'] },
  { id: '10', title: 'Improvement',                subclauses: ['10.1', '10.2', '10.3'] },
];

// ── Standard color palette ─────────────────────────────────────
const STANDARD_COLORS: Record<string, string> = {
  iso_9001:  '#3B82F6',
  iso_14001: '#22C55E',
  iso_45001: '#F59E0B',
};

// ── Score → color mapping ──────────────────────────────────────
function getCellColor(status: CellStatus, score: number): string {
  switch (status) {
    case 'audited':      return '#22C55E'; // green
    case 'documented':   return '#3B82F6'; // blue
    case 'partial':      return '#F59E0B'; // amber
    case 'gap':          return '#EF4444'; // red
    case 'critical_gap': return '#EF4444'; // red (pulsing via CSS)
    case 'na':           return '#6B7280'; // gray
    default:
      // Fallback: derive from score
      if (score >= 80) return '#22C55E';
      if (score >= 60) return '#3B82F6';
      if (score >= 40) return '#F59E0B';
      if (score >= 1)  return '#EF4444';
      return '#6B7280';
  }
}

function getCellBg(status: CellStatus, score: number): string {
  const base = getCellColor(status, score);
  return base + '20'; // 12% opacity background
}

function getStatusLabel(status: CellStatus): string {
  switch (status) {
    case 'audited':      return 'Audited';
    case 'documented':   return 'Documented';
    case 'partial':      return 'Partial';
    case 'gap':          return 'Gap';
    case 'critical_gap': return 'Critical Gap';
    case 'na':           return 'N/A';
    default:             return 'Unknown';
  }
}

// ── Derive status from score ───────────────────────────────────
export function deriveStatus(score: number, isCritical?: boolean): CellStatus {
  if (score <= 0)   return 'na';
  if (isCritical && score < 40) return 'critical_gap';
  if (score >= 80)  return 'audited';
  if (score >= 60)  return 'documented';
  if (score >= 40)  return 'partial';
  return 'gap';
}

// ── Component ──────────────────────────────────────────────────
export function ComplianceHeatmap({ cells, standards, onCellClick }: ComplianceHeatmapProps) {
  // Build lookup: `${clause}|${standard}` → HeatmapCell
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of cells) {
      map.set(`${cell.clause}|${cell.standard}`, cell);
    }
    return map;
  }, [cells]);

  // Calculate per-standard coverage %
  const coverageByStandard = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const std of standards) {
      totals[std] = { sum: 0, count: 0 };
    }
    for (const clause of ANNEX_SL_CLAUSES) {
      for (const sub of clause.subclauses) {
        for (const std of standards) {
          const cell = cellMap.get(`${sub}|${std}`);
          totals[std]!.count++;
          if (cell && cell.status !== 'na') {
            totals[std]!.sum += cell.score;
          }
        }
      }
    }
    const result: Record<string, number> = {};
    for (const std of standards) {
      const t = totals[std]!;
      result[std] = t.count > 0 ? Math.round(t.sum / t.count) : 0;
    }
    return result;
  }, [cellMap, standards]);

  // Detect Triple Credit subclauses: all active standards are green (audited)
  const tripleCreditClauses = useMemo(() => {
    if (standards.length < 2) return new Set<string>();
    const result = new Set<string>();
    for (const clause of ANNEX_SL_CLAUSES) {
      for (const sub of clause.subclauses) {
        const allGreen = standards.every((std) => {
          const cell = cellMap.get(`${sub}|${std}`);
          return cell && cell.status === 'audited';
        });
        if (allGreen) result.add(sub);
      }
    }
    return result;
  }, [cellMap, standards]);

  const handleClick = useCallback(
    (clause: string, standard: IsoStandard) => {
      onCellClick?.(clause, standard);
    },
    [onCellClick],
  );

  if (standards.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 text-center"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
          Select at least one standard to view the heat map.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--content-border)' }}
      >
        <div className="flex items-center gap-3">
          <SentinelAvatar sentinelId="qualy" size={28} />
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--content-text-muted)' }}
          >
            Compliance Heat Map
          </h3>
        </div>
        {tripleCreditClauses.size > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-400">
            <span className="text-amber-400">&#9733;</span>
            {tripleCreditClauses.size} Triple Credit
          </Badge>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--content-border)' }}>
              <th
                className="px-4 py-2 text-left font-semibold"
                style={{ color: 'var(--content-text-muted)', width: '40%' }}
              >
                Clause
              </th>
              {standards.map((std) => (
                <th
                  key={std}
                  className="px-2 py-2 text-center font-semibold"
                  style={{ color: STANDARD_COLORS[std] ?? 'var(--content-text-muted)' }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STANDARD_COLORS[std] }}
                    />
                    {ISO_STANDARD_LABELS[std]}
                  </div>
                </th>
              ))}
              {standards.length >= 2 && (
                <th
                  className="px-2 py-2 text-center font-semibold"
                  style={{ color: 'var(--content-text-muted)' }}
                >
                  <span className="text-amber-400">&#9733;</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ANNEX_SL_CLAUSES.map((clause) => (
              <>
                {/* Section header row */}
                <tr
                  key={`hdr-${clause.id}`}
                  style={{ backgroundColor: 'var(--content-bg)', borderTop: '1px solid var(--content-border)' }}
                >
                  <td
                    colSpan={standards.length + (standards.length >= 2 ? 2 : 1)}
                    className="px-4 py-2 font-bold"
                    style={{ color: 'var(--content-text)' }}
                  >
                    Clause {clause.id} — {clause.title}
                  </td>
                </tr>
                {/* Subclause rows */}
                {clause.subclauses.map((sub) => {
                  const isTriple = tripleCreditClauses.has(sub);
                  return (
                    <tr
                      key={sub}
                      className="transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: '1px solid var(--content-border)' }}
                    >
                      <td className="px-4 py-1.5 pl-8" style={{ color: 'var(--content-text-dim)' }}>
                        {sub}
                        {isTriple && (
                          <span className="ml-1.5 text-amber-400" title="Triple Credit — conformant across all active standards">
                            &#9733;
                          </span>
                        )}
                      </td>
                      {standards.map((std) => {
                        const cell = cellMap.get(`${sub}|${std}`);
                        const score = cell?.score ?? 0;
                        const status = cell?.status ?? 'na';
                        const color = getCellColor(status, score);
                        const bg = getCellBg(status, score);
                        const tooltip = cell?.label
                          ? `${sub} ${ISO_STANDARD_LABELS[std]}: ${cell.label} (${score}%)`
                          : `${sub} ${ISO_STANDARD_LABELS[std]}: ${getStatusLabel(status)} (${score}%)`;
                        const isCritical = status === 'critical_gap';

                        return (
                          <td key={std} className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleClick(sub, std)}
                              title={tooltip}
                              className={`
                                inline-flex items-center justify-center
                                rounded-md px-2.5 py-1 font-mono font-medium
                                transition-all hover:scale-110 hover:shadow-lg
                                cursor-pointer border
                                ${isCritical ? 'animate-pulse' : ''}
                              `}
                              style={{
                                color,
                                backgroundColor: bg,
                                borderColor: color + '40',
                                minWidth: 48,
                              }}
                            >
                              {status === 'na' ? '—' : `${score}%`}
                            </button>
                          </td>
                        );
                      })}
                      {/* Triple Credit column */}
                      {standards.length >= 2 && (
                        <td className="px-2 py-1.5 text-center">
                          {isTriple ? (
                            <span
                              className="inline-flex items-center justify-center rounded-full text-amber-400"
                              style={{ width: 24, height: 24, backgroundColor: '#F59E0B20' }}
                              title="Triple Credit — conformant across all active standards"
                            >
                              &#9733;
                            </span>
                          ) : (
                            <span style={{ color: 'var(--content-text-dim)', opacity: 0.3 }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </>
            ))}

            {/* ── Summary row ────────────────────────────────── */}
            <tr style={{ borderTop: '2px solid var(--content-border)', backgroundColor: 'var(--content-bg)' }}>
              <td className="px-4 py-3 font-bold" style={{ color: 'var(--content-text)' }}>
                Overall Coverage
              </td>
              {standards.map((std) => {
                const pct = coverageByStandard[std] ?? 0;
                const color = pct >= 80 ? '#22C55E' : pct >= 60 ? '#3B82F6' : pct >= 40 ? '#F59E0B' : '#EF4444';
                return (
                  <td key={std} className="px-2 py-3 text-center">
                    <span className="text-lg font-bold" style={{ color }}>
                      {pct}%
                    </span>
                  </td>
                );
              })}
              {standards.length >= 2 && (
                <td className="px-2 py-3 text-center">
                  <span className="text-xs font-bold text-amber-400">
                    {tripleCreditClauses.size}/{ANNEX_SL_CLAUSES.reduce((n, c) => n + c.subclauses.length, 0)}
                  </span>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Legend ────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-4 px-4 py-2.5"
        style={{ borderTop: '1px solid var(--content-border)' }}
      >
        {([
          { status: 'audited' as CellStatus,      label: 'Audited (80-100%)' },
          { status: 'documented' as CellStatus,   label: 'Documented (60-79%)' },
          { status: 'partial' as CellStatus,      label: 'Partial (40-59%)' },
          { status: 'gap' as CellStatus,          label: 'Gap (1-39%)' },
          { status: 'critical_gap' as CellStatus, label: 'Critical Gap' },
          { status: 'na' as CellStatus,           label: 'N/A' },
        ]).map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-sm ${status === 'critical_gap' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: getCellColor(status, status === 'na' ? 0 : 50) }}
            />
            <span className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>
              {label}
            </span>
          </div>
        ))}
        {standards.length >= 2 && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 text-xs">&#9733;</span>
            <span className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>
              Triple Credit
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
