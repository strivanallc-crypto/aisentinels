'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  BarChart3,
  Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiApi } from '@/lib/api';
import type { IsoStandard } from '@/lib/types';
import { ComplianceHeatmap, deriveStatus } from '@/components/compliance/compliance-heatmap';
import type { HeatmapCell } from '@/components/compliance/compliance-heatmap';
import {
  SentinelPageHero,
  PrimaryButton,
  SectionLabel,
  ContentCard,
} from '@/components/ui/sentinel-page-hero';

const STANDARDS: { value: IsoStandard; label: string; color: string }[] = [
  { value: 'iso_9001', label: 'ISO 9001', color: '#3B82F6' },
  { value: 'iso_14001', label: 'ISO 14001', color: '#22C55E' },
  { value: 'iso_45001', label: 'ISO 45001', color: '#F59E0B' },
];

const ANNEX_SL_CLAUSES = [
  { id: '4', title: 'Context of the Organisation', subclauses: ['4.1', '4.2', '4.3', '4.4'] },
  { id: '5', title: 'Leadership', subclauses: ['5.1', '5.2', '5.3'] },
  { id: '6', title: 'Planning', subclauses: ['6.1', '6.2', '6.3'] },
  { id: '7', title: 'Support', subclauses: ['7.1', '7.2', '7.3', '7.4', '7.5'] },
  { id: '8', title: 'Operation', subclauses: ['8.1', '8.2'] },
  { id: '9', title: 'Performance Evaluation', subclauses: ['9.1', '9.2', '9.3'] },
  { id: '10', title: 'Improvement', subclauses: ['10.1', '10.2', '10.3'] },
];

interface GapResult {
  gaps: { clause: string; standard: string; severity: string; description: string }[];
  suggestions: { clause: string; standard: string; recommendation: string }[];
  coverageByStandard: Record<string, number>;
}

type ViewTab = 'matrix' | 'heatmap';

function adaptMatrixToHeatmap(gapResult: GapResult, standards: IsoStandard[]): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (const clause of ANNEX_SL_CLAUSES) {
    for (const sub of clause.subclauses) {
      for (const std of standards) {
        const gap = gapResult.gaps.find((g) => g.clause === sub && g.standard === std);
        const overallCoverage = gapResult.coverageByStandard[std] ?? 0;
        if (gap) {
          const score = gap.severity === 'high' ? 15 : gap.severity === 'medium' ? 35 : 50;
          const isCritical = gap.severity === 'high';
          cells.push({ clause: sub, standard: std, score, status: deriveStatus(score, isCritical), label: gap.description });
        } else {
          const score = Math.max(Math.min(Math.round(overallCoverage), 100), 80);
          cells.push({ clause: sub, standard: std, score, status: deriveStatus(score), label: 'No gaps detected' });
        }
      }
    }
  }
  return cells;
}

export default function ComplianceMatrixPage() {
  const router = useRouter();
  const [selectedStandards, setSelectedStandards] = useState<IsoStandard[]>(['iso_9001']);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<GapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('matrix');

  const heatmapCells = useMemo<HeatmapCell[]>(() => {
    if (!result) return [];
    return adaptMatrixToHeatmap(result, selectedStandards);
  }, [result, selectedStandards]);

  const handleCellClick = useCallback(
    (clause: string, standard: IsoStandard) => {
      router.push(`/capa?clause=${encodeURIComponent(clause)}&standard=${encodeURIComponent(standard)}`);
    },
    [router],
  );

  const toggleStandard = (s: IsoStandard) => {
    setSelectedStandards((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await aiApi.gapDetect({ standards: selectedStandards });
      setResult(res.data as GapResult);
    } catch {
      setError('Gap analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.gaps.map((g) => `${g.standard} ${g.clause} [${g.severity}]: ${g.description}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityBg = (severity: string) => {
    if (severity === 'high') return { color: '#EF4444', bg: '#EF44441a' };
    if (severity === 'medium') return { color: '#F59E0B', bg: '#F59E0B1a' };
    return { color: '#6b7280', bg: 'rgba(255,255,255,0.05)' };
  };

  return (
    <div className="p-6 max-w-[1280px]">
      {/* ── Hero ── */}
      <SentinelPageHero
        sectionLabel="COMPLIANCE MATRIX"
        title="One IMS. Three Standards."
        subtitle="Qualy maps your Annex SL clause coverage across ISO 9001, 14001, and 45001 simultaneously."
        sentinelColor="#3B82F6"
        stats={
          result
            ? STANDARDS.filter((s) => selectedStandards.includes(s.value)).map((s) => ({
                value: `${Math.round(result.coverageByStandard[s.value] ?? 0)}%`,
                label: s.label,
              }))
            : undefined
        }
      />

      {/* ── Standard selector + actions ── */}
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
                  borderColor: selectedStandards.includes(s.value) ? s.color : 'rgba(255,255,255,0.1)',
                  background: selectedStandards.includes(s.value) ? `${s.color}1a` : 'transparent',
                  color: selectedStandards.includes(s.value) ? s.color : '#6b7280',
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <PrimaryButton onClick={handleAnalyze} disabled={analyzing || selectedStandards.length === 0}>
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analyzing ? 'Analysing...' : 'AI Gap Analysis'}
        </PrimaryButton>
      </div>

      {/* ── View tabs ── */}
      <div className="flex gap-1 rounded-full border p-1 mb-6 w-fit" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'matrix' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          <Grid3X3 className="h-3.5 w-3.5" /> Matrix
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'heatmap' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Heat Map
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.15)' }}>
          {error}
        </div>
      )}

      {/* ── Heat Map tab ── */}
      {activeTab === 'heatmap' && (
        result ? (
          <ComplianceHeatmap cells={heatmapCells} standards={selectedStandards} onCellClick={handleCellClick} />
        ) : (
          <ContentCard>
            <div className="py-12 text-center">
              <BarChart3 className="mx-auto h-8 w-8 mb-3" style={{ color: '#4b5563' }} />
              <p className="text-sm" style={{ color: '#6b7280' }}>Run AI Gap Analysis first to generate the heat map.</p>
            </div>
          </ContentCard>
        )
      )}

      {/* ── Matrix tab ── */}
      {activeTab === 'matrix' && (
        <>
          {/* Coverage scores */}
          {result?.coverageByStandard && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {STANDARDS.filter((s) => selectedStandards.includes(s.value)).map((s) => {
                const pct = Math.round(result.coverageByStandard[s.value] ?? 0);
                return (
                  <ContentCard key={s.value}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm font-semibold">{s.label}</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold font-heading" style={{ color: s.color }}>{pct}%</span>
                      <span className="text-[11px] mb-1" style={{ color: '#6b7280' }}>coverage</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </ContentCard>
                );
              })}
            </div>
          )}

          {/* Annex SL Clause Grid */}
          <ContentCard>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#6b7280' }}>/ ANNEX SL CLAUSE STRUCTURE</p>
              {result && (
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy Gaps'}
                </Button>
              )}
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {ANNEX_SL_CLAUSES.map((clause) => {
                const clauseGaps = result?.gaps.filter((g) => g.clause.startsWith(clause.id)) ?? [];
                const hasGaps = clauseGaps.length > 0;
                return (
                  <div key={clause.id} className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Clause {clause.id}</span>
                        <span className="text-sm" style={{ color: '#6b7280' }}>{clause.title}</span>
                      </div>
                      {result && (
                        hasGaps ? (
                          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ color: '#EF4444', background: '#EF44441a' }}>
                            {clauseGaps.length} gap{clauseGaps.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#22C55E' }}>
                            <CheckCircle2 className="h-3 w-3" /> Covered
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {clause.subclauses.map((sub) => {
                        const subGap = result?.gaps.find((g) => g.clause === sub);
                        const style = subGap ? getSeverityBg(subGap.severity) : result ? { color: '#22C55E', bg: '#22C55E1a' } : { color: '#4b5563', bg: 'rgba(255,255,255,0.05)' };
                        return (
                          <div key={sub} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ color: style.color, background: style.bg, borderColor: `${style.color}30` }} title={subGap?.description}>
                            {sub}
                            {subGap && <span className="ml-1 text-[10px]">({subGap.severity})</span>}
                          </div>
                        );
                      })}
                    </div>
                    {clauseGaps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {clauseGaps.map((g, idx) => {
                          const s = getSeverityBg(g.severity);
                          return (
                            <div key={idx} className="flex items-start gap-2 text-xs" style={{ color: '#6b7280' }}>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 mt-0.5" style={{ color: s.color, background: s.bg }}>
                                {g.severity}
                              </span>
                              <span><strong>{g.standard.replace('_', ' ').toUpperCase()} {g.clause}:</strong> {g.description}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ContentCard>

          {/* Suggestions */}
          {result && result.suggestions && result.suggestions.length > 0 && (
            <ContentCard className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '#6b7280' }}>/ AI RECOMMENDATIONS</p>
              <div className="space-y-2">
                {result.suggestions.slice(0, 10).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0 mt-0.5" style={{ color: '#3B82F6', background: '#3B82F61a' }}>
                      {s.standard?.replace('_', ' ') ?? ''} {s.clause}
                    </span>
                    <span>{s.recommendation}</span>
                  </div>
                ))}
              </div>
            </ContentCard>
          )}
        </>
      )}
    </div>
  );
}
