'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Loader2, Grid3X3, BarChart3 } from 'lucide-react';
import type { Document, IsoStandard } from '@/lib/types';
import { documentsApi } from '@/lib/api';
import {
  SentinelPageHero,
  PrimaryButton,
  SectionLabel,
  ContentCard,
} from '@/components/ui/sentinel-page-hero';
import { ANNEX_SL_CLAUSES } from '@/components/compliance-matrix/annex-sl-clauses';
import { computeCoverage, computeCellScore } from '@/components/compliance-matrix/coverage-utils';
import { HeatMapGrid } from '@/components/compliance-matrix/heat-map-grid';
import { CellDetailPanel } from '@/components/compliance-matrix/cell-detail-panel';
import { GapAnalysisPanel } from '@/components/compliance-matrix/gap-analysis-panel';

const STANDARDS: { value: IsoStandard; label: string; color: string }[] = [
  { value: 'iso_9001',  label: 'ISO 9001',  color: '#3B82F6' },
  { value: 'iso_14001', label: 'ISO 14001', color: '#22C55E' },
  { value: 'iso_45001', label: 'ISO 45001', color: '#F59E0B' },
];

type ViewTab = 'heatmap' | 'table';

export default function ComplianceMatrixPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [activeStandards, setActiveStandards] = useState<IsoStandard[]>([
    'iso_9001',
    'iso_14001',
    'iso_45001',
  ]);
  const [activeTab, setActiveTab] = useState<ViewTab>('heatmap');
  const [gapPanelOpen, setGapPanelOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    clauseId: string;
    standard: IsoStandard;
  } | null>(null);

  // Fetch documents on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await documentsApi.list();
        const data = res.data as { documents?: Document[] } | Document[];
        const docs = Array.isArray(data) ? data : data.documents ?? [];
        if (!cancelled) setDocuments(docs);
      } catch {
        // Empty state is fine — all cells will be red
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Coverage scores
  const coverageScores = useMemo(() => {
    return STANDARDS.map((s) => ({
      ...s,
      coverage: computeCoverage(documents, s.value),
    }));
  }, [documents]);

  // Gap clause list (for gap analysis panel)
  const gapClauses = useMemo(() => {
    const gaps: string[] = [];
    for (const clause of ANNEX_SL_CLAUSES) {
      const hasAnyApproved = activeStandards.some(
        (std) => computeCellScore(documents, clause.id, std) === 100,
      );
      if (!hasAnyApproved) gaps.push(clause.id);
    }
    return gaps;
  }, [documents, activeStandards]);

  const coveredCount = ANNEX_SL_CLAUSES.length - gapClauses.length;

  const toggleStandard = (s: IsoStandard) => {
    setActiveStandards((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleCellClick = useCallback(
    (clauseId: string, standard: IsoStandard) => {
      setSelectedCell({ clauseId, standard });
    },
    [],
  );

  const handleFixWithAi = useCallback(() => {
    setSelectedCell(null);
    setGapPanelOpen(true);
  }, []);

  return (
    <div className="p-6 max-w-[1280px]">
      {/* ── Hero ── */}
      <SentinelPageHero
        sectionLabel="COMPLIANCE MATRIX"
        title="One IMS. Three Standards."
        subtitle="Map your Annex SL clause coverage across ISO 9001, 14001, and 45001 simultaneously."
        sentinelColor="#c2fa69"
        stats={coverageScores.map((s) => ({
          value: `${s.coverage}%`,
          label: s.label,
        }))}
      />

      {/* ── KPI Coverage Cards ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {coverageScores.map((s) => (
          <ContentCard key={s.value}>
            <div
              className="h-1 w-full rounded-full mb-4"
              style={{ backgroundColor: s.color }}
            />
            <div className="flex items-center gap-2 mb-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {s.label}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span
                className="text-4xl font-bold font-heading tabular-nums"
                style={{ color: s.color }}
              >
                {loadingDocs ? '—' : s.coverage}
              </span>
              <span
                className="text-sm mb-1 font-heading"
                style={{ color: s.color, opacity: 0.7 }}
              >
                %
              </span>
            </div>
            <p
              className="text-[11px] mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              clause coverage
            </p>
          </ContentCard>
        ))}
      </div>

      {/* ── Toolbar: Standard toggles + View toggle + Gap Analysis button ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SectionLabel>STANDARDS</SectionLabel>
          <div className="flex gap-2 ml-4">
            {STANDARDS.map((s) => (
              <button
                key={s.value}
                onClick={() => toggleStandard(s.value)}
                className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-all hover:scale-[1.02]"
                style={{
                  borderColor: activeStandards.includes(s.value)
                    ? s.color
                    : 'var(--border)',
                  background: activeStandards.includes(s.value)
                    ? `${s.color}1a`
                    : 'transparent',
                  color: activeStandards.includes(s.value)
                    ? s.color
                    : 'var(--text-muted)',
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div
            className="flex gap-1 rounded-full border p-1"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            <button
              onClick={() => setActiveTab('heatmap')}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200"
              style={{
                background:
                  activeTab === 'heatmap' ? 'var(--bg-elevated)' : 'transparent',
                color:
                  activeTab === 'heatmap'
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
              }}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Heat Map
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200"
              style={{
                background:
                  activeTab === 'table' ? 'var(--bg-elevated)' : 'transparent',
                color:
                  activeTab === 'table'
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
              }}
            >
              <Grid3X3 className="h-3.5 w-3.5" /> Table
            </button>
          </div>

          {/* Run Gap Analysis */}
          <PrimaryButton
            onClick={() => setGapPanelOpen(true)}
            disabled={activeStandards.length === 0}
          >
            <Sparkles className="h-4 w-4" />
            Run Gap Analysis
          </PrimaryButton>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loadingDocs && (
        <ContentCard>
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2
              className="h-5 w-5 animate-spin"
              style={{ color: 'var(--text-muted)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading documents...
            </span>
          </div>
        </ContentCard>
      )}

      {/* ── Heat Map Grid ── */}
      {!loadingDocs && (activeTab === 'heatmap' || activeTab === 'table') && (
        <HeatMapGrid
          documents={documents}
          activeStandards={activeStandards}
          onCellClick={handleCellClick}
        />
      )}

      {/* ── Gap Analysis Panel ── */}
      <GapAnalysisPanel
        open={gapPanelOpen}
        onClose={() => setGapPanelOpen(false)}
        activeStandards={activeStandards}
        gapClauses={gapClauses}
        coveredCount={coveredCount}
      />

      {/* ── Cell Detail Panel ── */}
      {selectedCell && (
        <CellDetailPanel
          clauseId={selectedCell.clauseId}
          standard={selectedCell.standard}
          documents={documents}
          onClose={() => setSelectedCell(null)}
          onFixWithAi={handleFixWithAi}
        />
      )}
    </div>
  );
}
