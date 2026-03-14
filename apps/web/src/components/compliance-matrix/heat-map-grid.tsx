'use client';

import { useMemo } from 'react';
import type { Document, IsoStandard } from '@/lib/types';
import { ANNEX_SL_CLAUSES } from './annex-sl-clauses';
import { computeCellScore, computeCoverage, getDocsForCell } from './coverage-utils';

const STANDARD_META: Record<string, { label: string; color: string }> = {
  iso_9001:  { label: 'ISO 9001', color: '#3B82F6' },
  iso_14001: { label: 'ISO 14001', color: '#22C55E' },
  iso_45001: { label: 'ISO 45001', color: '#F59E0B' },
};

/** Solid heat-map colors — full opacity, thermal feel */
function heatColor(score: number) {
  if (score === 100) return { bg: '#16a34a', hover: '#15803d' }; // green-600
  if (score === 50)  return { bg: '#d97706', hover: '#b45309' }; // amber-600
  return { bg: '#991b1b', hover: '#7f1d1d' };                    // red-800
}

/** Table/compact cell colors — translucent */
function tableCellStyle(score: number) {
  if (score === 100) {
    return { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' };
  }
  if (score === 50) {
    return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' };
  }
  return { bg: 'rgba(239,68,68,0.15)', text: '#f87171' };
}

interface HeatMapGridProps {
  documents: Document[];
  activeStandards: IsoStandard[];
  onCellClick: (clauseId: string, standard: IsoStandard) => void;
  compact?: boolean;
}

export function HeatMapGrid({ documents, activeStandards, onCellClick, compact = false }: HeatMapGridProps) {
  const coverageByStandard = useMemo(() => {
    const result: Record<string, number> = {};
    for (const std of activeStandards) {
      result[std] = computeCoverage(documents, std);
    }
    return result;
  }, [documents, activeStandards]);

  if (activeStandards.length === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Select at least one standard to view the heat map.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', width: compact ? 200 : 120 }}
              >
                {compact ? 'Annex SL Clause' : 'Clause'}
              </th>
              {activeStandards.map((std) => {
                const meta = STANDARD_META[std];
                return (
                  <th key={std} className="px-3 py-3 text-center" style={{ minWidth: compact ? 140 : 64 }}>
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: meta?.color }}
                      />
                      <span className="text-xs font-semibold" style={{ color: meta?.color }}>
                        {meta?.label}
                      </span>
                    </div>
                    <div
                      className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: `${meta?.color}1a`,
                        color: meta?.color,
                      }}
                    >
                      {coverageByStandard[std] ?? 0}%
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ANNEX_SL_CLAUSES.map((clause) => (
              <tr
                key={clause.id}
                className="transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {/* Row label */}
                <td className="px-4 py-2">
                  {compact ? (
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {clause.id}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {clause.title}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="font-mono text-[11px] font-bold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {clause.id}
                    </span>
                  )}
                </td>

                {/* Cells */}
                {activeStandards.map((std) => {
                  const score = computeCellScore(documents, clause.id, std);
                  const { approved, draft } = getDocsForCell(documents, clause.id, std);
                  const docCount = approved.length + draft.length;
                  const statusLabel = score === 100 ? 'Covered' : score === 50 ? 'Partial' : 'Gap';
                  const tooltip = `${clause.id} — ${clause.title}\n${statusLabel}${docCount > 0 ? ` — ${docCount} doc${docCount !== 1 ? 's' : ''}` : ''}`;

                  if (compact) {
                    // ── Table view: translucent cells with status text ──
                    const ts = tableCellStyle(score);
                    return (
                      <td
                        key={std}
                        onClick={() => onCellClick(clause.id, std)}
                        title={tooltip}
                        className={`px-3 py-2 text-center cursor-pointer transition-colors hover:brightness-125 ${score === 0 ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: ts.bg, color: ts.text }}
                      >
                        <span className="text-[11px] font-bold">
                          {score === 100 ? '✓' : score === 50 ? '⚠' : '✕'}
                          {' '}
                          {score === 100 ? `${docCount}` : score === 50 ? 'Draft' : 'Gap'}
                        </span>
                      </td>
                    );
                  }

                  // ── Heat-map view: solid colored squares, no text ──
                  const hc = heatColor(score);
                  return (
                    <td key={std} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onCellClick(clause.id, std)}
                        title={tooltip}
                        className={`mx-auto block rounded-md transition-all hover:scale-110 cursor-pointer ${score === 0 ? 'animate-pulse' : ''}`}
                        style={{
                          width: 48,
                          height: 48,
                          backgroundColor: hc.bg,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = hc.hover;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = hc.bg;
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
