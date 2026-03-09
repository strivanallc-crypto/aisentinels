'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Grid3X3,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { aiApi } from '@/lib/api';
import type { IsoStandard } from '@/lib/types';
import { ISO_STANDARD_LABELS } from '@/lib/types';
import { ComplianceHeatmap, deriveStatus } from '@/components/compliance/compliance-heatmap';
import type { HeatmapCell } from '@/components/compliance/compliance-heatmap';

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

// ── Adapter: GapResult → HeatmapCell[] ─────────────────────────
function adaptMatrixToHeatmap(
  gapResult: GapResult,
  standards: IsoStandard[],
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];

  for (const clause of ANNEX_SL_CLAUSES) {
    for (const sub of clause.subclauses) {
      for (const std of standards) {
        const gap = gapResult.gaps.find(
          (g) => g.clause === sub && g.standard === std,
        );
        const overallCoverage = gapResult.coverageByStandard[std] ?? 0;

        if (gap) {
          // Map gap severity to a score
          const score = gap.severity === 'high' ? 15 : gap.severity === 'medium' ? 35 : 50;
          const isCritical = gap.severity === 'high';
          cells.push({
            clause: sub,
            standard: std,
            score,
            status: deriveStatus(score, isCritical),
            label: gap.description,
          });
        } else {
          // No gap found → use overall coverage as base score, capped at 100
          const score = Math.min(Math.round(overallCoverage), 100);
          cells.push({
            clause: sub,
            standard: std,
            score: Math.max(score, 80), // No gap = at least 80%
            status: deriveStatus(Math.max(score, 80)),
            label: 'No gaps detected',
          });
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

  // Derive heatmap cells from gap analysis result
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
    setSelectedStandards((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await aiApi.gapDetect({
        standards: selectedStandards,
      });
      setResult(res.data as GapResult);
    } catch {
      setError('Gap analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.gaps.map((g) =>
      `${g.standard} ${g.clause} [${g.severity}]: ${g.description}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return 'destructive';
    if (severity === 'medium') return 'warning';
    return 'secondary';
  };

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SentinelAvatar sentinelId="qualy" size={36} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              ISO Platform › Compliance Matrix
            </p>
            <h1 className="mt-1 text-2xl font-bold">Compliance Matrix</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
              Annex SL clause coverage across ISO 9001, 14001, 45001
            </p>
          </div>
        </div>
      </div>

      {/* Standard selector + Action */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {STANDARDS.map((s) => (
            <button
              key={s.value}
              onClick={() => toggleStandard(s.value)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                selectedStandards.includes(s.value)
                  ? 'border-blue-500/30 bg-blue-500/15 text-blue-300 font-medium'
                  : 'border-white/10 hover:border-white/20'
              }`}
              style={selectedStandards.includes(s.value) ? undefined : { color: 'var(--content-text-dim)' }}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing || selectedStandards.length === 0}>
          {analyzing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          {analyzing ? 'Analysing…' : 'AI Gap Analysis'}
        </Button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--content-border)', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'matrix'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          Matrix
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'heatmap'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Heat Map
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Heat Map tab ────────────────────────────────────── */}
      {activeTab === 'heatmap' && (
        result ? (
          <ComplianceHeatmap
            cells={heatmapCells}
            standards={selectedStandards}
            onCellClick={handleCellClick}
          />
        ) : (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <BarChart3 className="mx-auto h-8 w-8 mb-3" style={{ color: 'var(--content-text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
              Run <strong>AI Gap Analysis</strong> first to generate the heat map.
            </p>
          </div>
        )
      )}

      {/* ── Matrix tab (existing content) ───────────────────── */}
      {activeTab === 'matrix' && <>
      {/* Coverage scores */}
      {result?.coverageByStandard && (
        <div className="grid grid-cols-3 gap-4">
          {STANDARDS.filter((s) => selectedStandards.includes(s.value)).map((s) => {
            const coverage = result.coverageByStandard[s.value] ?? 0;
            const pct = Math.round(coverage);
            return (
              <div
                key={s.value}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{pct}%</span>
                  <span className="text-xs mb-1" style={{ color: 'var(--content-text-muted)' }}>coverage</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Annex SL Clause Grid */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            Annex SL Clause Structure
          </span>
          {result && (
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? 'Copied' : 'Copy Gaps'}
            </Button>
          )}
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--content-border)' }}>
          {ANNEX_SL_CLAUSES.map((clause) => {
            const clauseGaps = result?.gaps.filter((g) => g.clause.startsWith(clause.id)) ?? [];
            const hasGaps = clauseGaps.length > 0;

            return (
              <div key={clause.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--content-text)' }}>
                      Clause {clause.id}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
                      {clause.title}
                    </span>
                  </div>
                  {result && (
                    hasGaps ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {clauseGaps.length} gap{clauseGaps.length > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Covered
                      </span>
                    )
                  )}
                </div>

                {/* Subclauses */}
                <div className="flex gap-2 flex-wrap">
                  {clause.subclauses.map((sub) => {
                    const subGap = result?.gaps.find((g) => g.clause === sub);
                    return (
                      <div
                        key={sub}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          subGap
                            ? subGap.severity === 'high'
                              ? 'border-red-500/20 bg-red-500/10 text-red-400'
                              : subGap.severity === 'medium'
                                ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                : 'border-white/10 bg-white/5'
                            : result
                              ? 'border-green-500/20 bg-green-500/10 text-green-400'
                              : 'border-white/10 bg-white/5'
                        }`}
                        style={(!subGap && !result) || (subGap && subGap.severity !== 'high' && subGap.severity !== 'medium') ? { color: 'var(--content-text-dim)' } : undefined}
                        title={subGap?.description}
                      >
                        {sub}
                        {subGap && (
                          <span className="ml-1 text-[10px]">
                            ({subGap.severity})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Gap details */}
                {clauseGaps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {clauseGaps.map((g, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--content-text-dim)' }}>
                        <Badge variant={getSeverityColor(g.severity) as 'destructive' | 'warning' | 'secondary'} className="text-[10px] flex-shrink-0 mt-0.5">
                          {g.severity}
                        </Badge>
                        <span>
                          <strong>{g.standard.replace('_', ' ').toUpperCase()} {g.clause}:</strong>{' '}
                          {g.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggestions */}
      {result && result.suggestions && result.suggestions.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--content-text-muted)' }}>
            AI Recommendations
          </h3>
          <div className="space-y-2">
            {result.suggestions.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5">
                  {s.standard?.replace('_', ' ') ?? ''} {s.clause}
                </Badge>
                <span style={{ color: 'var(--content-text)' }}>{s.recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
