'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { aiApi } from '@/lib/api';
import type { IsoStandard } from '@/lib/types';

interface GapItem {
  clause: string;
  standard: string;
  severity: 'critical' | 'major' | 'minor';
  recommendation: string;
  suggestedDocType: string;
}

interface GapAnalysisResult {
  summary: string;
  gaps: GapItem[];
  overallScore: number;
}

const SEVERITY_COLORS: Record<string, { text: string; bg: string }> = {
  critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  major:    { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  minor:    { text: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const STANDARD_LABELS: Record<string, string> = {
  iso_9001: 'ISO 9001',
  iso_14001: 'ISO 14001',
  iso_45001: 'ISO 45001',
};

/**
 * 4-tier robust JSON parser for AI responses.
 * AI models may wrap JSON in markdown, add commentary, or return arrays.
 */
function parseResponse(raw: string): GapAnalysisResult | null {
  // Tier 1: Direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    if (parsed.gaps) return parsed as GapAnalysisResult;
    // AI returned array instead of object — wrap it
    if (Array.isArray(parsed)) {
      return { summary: '', gaps: parsed as GapItem[], overallScore: 0 };
    }
  } catch {
    // fallback to tier 2
  }

  // Tier 2: Extract from ```json ... ``` markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed.gaps) return parsed as GapAnalysisResult;
      if (Array.isArray(parsed)) {
        return { summary: '', gaps: parsed as GapItem[], overallScore: 0 };
      }
    } catch {
      // fallback to tier 3
    }
  }

  // Tier 3: Extract first { ... } block containing "gaps"
  const jsonMatch = raw.match(/\{[\s\S]*"gaps"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.gaps) return parsed as GapAnalysisResult;
    } catch {
      // fallback to tier 4
    }
  }

  // Tier 4: Extract [...] array if AI returned bare array
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { summary: '', gaps: parsed as GapItem[], overallScore: 0 };
      }
    } catch {
      // all tiers exhausted
    }
  }

  return null;
}

interface GapAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  activeStandards: IsoStandard[];
  gapClauses: string[];
  coveredCount: number;
}

export function GapAnalysisPanel({
  open,
  onClose,
  activeStandards,
  gapClauses,
  coveredCount,
}: GapAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GapAnalysisResult | null>(null);
  const [satisfiedCollapsed, setSatisfiedCollapsed] = useState(true);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const standards = activeStandards.length > 0 ? activeStandards : ['iso_9001'];

      // Use the dedicated gapDetect endpoint
      const res = await aiApi.gapDetect({
        standards,
        existingControls: gapClauses.map((c) => ({
          clause: c,
          status: 'missing',
        })),
      });

      // Log full response for debugging
      console.log('[GapAnalysis] Raw API response:', res.data);

      const data = res.data as Record<string, unknown>;
      const rawContent =
        typeof data === 'string'
          ? data
          : (data.content as string) ??
            (data.text as string) ??
            (data.result as string) ??
            JSON.stringify(data);

      console.log('[GapAnalysis] Raw content to parse:', rawContent);

      const parsed = parseResponse(rawContent);
      console.log('[GapAnalysis] Parsed result:', parsed);

      if (!parsed || parsed.gaps.length === 0) {
        setError('Could not parse analysis results. Check console for raw response. Try again.');
      } else {
        setResult(parsed);
      }
    } catch (err) {
      console.error('[GapAnalysis] API error:', err);
      setError('Analysis failed — check console for details. Try again.');
    } finally {
      setLoading(false);
    }
  }, [activeStandards, gapClauses]);

  if (!open) return null;

  return (
    <div
      className="mt-6 rounded-xl border overflow-hidden transition-all"
      style={{
        maxHeight: 400,
        borderColor: 'var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-muted)' }}
          >
            / Gap Analysis Results
          </span>
          {result && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{
                background: result.overallScore >= 70 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: result.overallScore >= 70 ? '#4ade80' : '#f87171',
              }}
            >
              {result.overallScore}% overall
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 340 }}>
        {/* Not yet run */}
        {!loading && !error && !result && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Click below to run AI-powered gap analysis across {activeStandards.length} standard{activeStandards.length !== 1 ? 's' : ''}.
            </p>
            <button
              onClick={runAnalysis}
              className="rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:scale-[1.02]"
              style={{ background: '#c2fa69', color: '#0a0f1a' }}
            >
              Run Gap Analysis
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#c2fa69' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Analysing... this may take up to 40 seconds
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <AlertTriangle className="h-5 w-5" style={{ color: '#f59e0b' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
            <button
              onClick={runAnalysis}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: '#c2fa69', color: '#0a0f1a' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            {result.summary && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {result.summary}
              </p>
            )}

            {/* Gap cards — 2-column grid */}
            {result.gaps.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.gaps.map((gap, i) => {
                  const sc = SEVERITY_COLORS[gap.severity] ?? SEVERITY_COLORS.minor;
                  return (
                    <div
                      key={i}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          [{STANDARD_LABELS[gap.standard] ?? gap.standard}:{gap.clause}]
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {gap.severity}
                        </span>
                      </div>
                      <p
                        className="text-[11px] leading-relaxed mb-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {gap.recommendation}
                      </p>
                      {gap.suggestedDocType && (
                        <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                          Suggested: {gap.suggestedDocType}
                        </p>
                      )}
                      <Link
                        href={`/document-studio/new?clause=${encodeURIComponent(gap.clause)}&standard=${encodeURIComponent(gap.standard)}`}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-white/5"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <FileText className="h-3 w-3" />
                        Create Document
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Satisfied — collapsible */}
            {coveredCount > 0 && (
              <div>
                <button
                  onClick={() => setSatisfiedCollapsed((p) => !p)}
                  className="flex items-center gap-2 text-xs font-semibold transition-colors"
                  style={{ color: '#4ade80' }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {satisfiedCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {coveredCount} Covered Clause{coveredCount !== 1 ? 's' : ''}
                </button>
                {!satisfiedCollapsed && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle2 className="h-3 w-3" style={{ color: '#4ade80' }} />
                      {coveredCount} of 19 clauses have approved documentation
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
