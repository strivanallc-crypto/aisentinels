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

/**
 * 5-level thermal gradient mapped from the 3 score values.
 * score 100 = full coverage (green-600)
 * score 50  = draft only   (orange-600)
 * score 0   = no docs      (red-950 + pulse)
 */
function heatColor(score: number): { bg: string; hover: string } {
  if (score === 100) return { bg: '#16a34a', hover: '#15803d' };  // green-600
  if (score === 50)  return { bg: '#ea580c', hover: '#c2410c' };  // orange-600
  return { bg: '#7f1d1d', hover: '#991b1b' };                     // red-950
}

/** Table/compact cell colors — translucent */
function tableCellStyle(score: number) {
  if (score === 100) return { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' };
  if (score === 50)  return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' };
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

  // ── Table / compact view ──
  if (compact) {
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
                  style={{ color: 'var(--text-muted)', width: 200 }}
                >
                  Annex SL Clause
                </th>
                {activeStandards.map((std) => {
                  const meta = STANDARD_META[std];
                  return (
                    <th key={std} className="px-3 py-3 text-center" style={{ minWidth: 140 }}>
                      <div className="flex items-center justify-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta?.color }} />
                        <span className="text-xs font-semibold" style={{ color: meta?.color }}>{meta?.label}</span>
                      </div>
                      <div
                        className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: `${meta?.color}1a`, color: meta?.color }}
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
                  <td className="px-4 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                        {clause.id}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{clause.title}</span>
                    </div>
                  </td>
                  {activeStandards.map((std) => {
                    const score = computeCellScore(documents, clause.id, std);
                    const ts = tableCellStyle(score);
                    const { approved, draft } = getDocsForCell(documents, clause.id, std);
                    const docCount = approved.length + draft.length;
                    const statusLabel = score === 100 ? 'Covered' : score === 50 ? 'Partial' : 'Gap';
                    const tooltip = `${clause.id} — ${clause.title}\n${statusLabel}${docCount > 0 ? ` — ${docCount} doc${docCount !== 1 ? 's' : ''}` : ''}`;
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
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Heat-map view: tight thermal density grid ──
  const colCount = activeStandards.length;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <div className="p-4">
        {/* Column headers */}
        <div className="flex items-end mb-2" style={{ paddingLeft: 48 }}>
          {activeStandards.map((std) => {
            const meta = STANDARD_META[std];
            return (
              <div
                key={std}
                className="flex flex-col items-center"
                style={{ width: 44 * 1, minWidth: 44 }}
              >
                <span className="h-2 w-2 rounded-full mb-1" style={{ backgroundColor: meta?.color }} />
                <span className="text-[9px] font-semibold leading-tight text-center" style={{ color: meta?.color }}>
                  {meta?.label?.replace('ISO ', '')}
                </span>
                <div
                  className="mt-0.5 rounded-full px-1.5 py-px text-[8px] font-bold"
                  style={{ backgroundColor: `${meta?.color}1a`, color: meta?.color }}
                >
                  {coverageByStandard[std] ?? 0}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        <div className="flex flex-col gap-1">
          {ANNEX_SL_CLAUSES.map((clause) => (
            <div key={clause.id} className="flex items-center gap-1 group">
              {/* Row label — clause number, right-aligned */}
              <div
                className="flex-shrink-0 text-right pr-2"
                style={{ width: 44 }}
                title={`${clause.id} — ${clause.title}`}
              >
                <span
                  className="font-mono text-[10px] font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {clause.id}
                </span>
              </div>

              {/* Heat cells */}
              <div className="flex gap-1">
                {activeStandards.map((std) => {
                  const score = computeCellScore(documents, clause.id, std);
                  const hc = heatColor(score);
                  const { approved, draft } = getDocsForCell(documents, clause.id, std);
                  const docCount = approved.length + draft.length;
                  const statusLabel = score === 100 ? 'Covered' : score === 50 ? 'Draft' : 'Gap';
                  const tooltip = `${clause.id} — ${clause.title}\n${STANDARD_META[std]?.label} — ${statusLabel}${docCount > 0 ? ` — ${docCount} doc${docCount !== 1 ? 's' : ''}` : ''}`;

                  return (
                    <button
                      key={std}
                      type="button"
                      onClick={() => onCellClick(clause.id, std)}
                      title={tooltip}
                      className={`rounded-lg transition-transform hover:scale-110 cursor-pointer ${score === 0 ? 'animate-pulse' : ''}`}
                      style={{
                        width: 40,
                        height: 40,
                        backgroundColor: hc.bg,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = hc.hover;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = hc.bg;
                      }}
                    />
                  );
                })}
              </div>

              {/* Clause title on row hover */}
              <span
                className="ml-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity truncate"
                style={{ color: 'var(--text-muted)', maxWidth: 200 }}
              >
                {clause.title}
              </span>
            </div>
          ))}
        </div>

        {/* Legend bar */}
        <div className="flex flex-col items-center mt-6 mb-2">
          <div
            className="rounded-full"
            style={{
              width: 200,
              height: 8,
              background: 'linear-gradient(to right, #7f1d1d, #dc2626, #ea580c, #ca8a04, #16a34a)',
            }}
          />
          <div className="flex justify-between mt-1" style={{ width: 200 }}>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No Coverage</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Full Coverage</span>
          </div>
        </div>
      </div>
    </div>
  );
}
