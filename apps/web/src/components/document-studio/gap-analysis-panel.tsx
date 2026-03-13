'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { aiApi } from '@/lib/api';

interface GapItem {
  clauseRef: string;
  title: string;
  severity: 'critical' | 'major' | 'minor';
  suggestion: string;
}

interface SatisfiedItem {
  clauseRef: string;
  title: string;
}

interface GapAnalysisResult {
  gaps: GapItem[];
  satisfied: SatisfiedItem[];
}

const SEVERITY_COLORS: Record<string, { text: string; bg: string }> = {
  critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  major: { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  minor: { text: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

function parseResponse(raw: string): GapAnalysisResult {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    if (parsed.gaps && parsed.satisfied) return parsed as GapAnalysisResult;
  } catch {
    // fallback
  }

  // Try extracting JSON from markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed.gaps && parsed.satisfied) return parsed as GapAnalysisResult;
    } catch {
      // fallback
    }
  }

  // Try finding any JSON object in the response
  const jsonMatch = raw.match(/\{[\s\S]*"gaps"[\s\S]*"satisfied"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.gaps && parsed.satisfied) return parsed as GapAnalysisResult;
    } catch {
      // fallback
    }
  }

  return { gaps: [], satisfied: [] };
}

interface GapAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  standards: string[];
  docType: string;
}

export function GapAnalysisPanel({
  open,
  onClose,
  editor,
  standards,
  docType,
}: GapAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GapAnalysisResult | null>(null);
  const [satisfiedCollapsed, setSatisfiedCollapsed] = useState(true);

  const runAnalysis = useCallback(async () => {
    if (!editor) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const editorText = editor.getText();
      if (!editorText.trim()) {
        setError('Document is empty. Add content before analyzing compliance.');
        setLoading(false);
        return;
      }

      const res = await aiApi.documentGenerate({
        documentType: 'compliance_gap_analysis',
        standards: standards.length > 0 ? standards : ['iso_9001'],
        orgContext: editorText,
        sections: ['gap_analysis'],
      });

      const data = res.data as { content?: string; text?: string; result?: string };
      const rawContent =
        typeof data === 'string'
          ? data
          : data.content ?? data.text ?? data.result ?? JSON.stringify(data);

      const parsed = parseResponse(rawContent);

      if (parsed.gaps.length === 0 && parsed.satisfied.length === 0) {
        setError('Could not parse analysis results. Try again.');
      } else {
        setResult(parsed);
      }
    } catch {
      setError('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [editor, standards]);

  useEffect(() => {
    if (open && !result && !loading && !error) {
      runAnalysis();
    }
  }, [open, result, loading, error, runAnalysis]);

  if (!open) return null;

  return (
    <div
      className="flex-shrink-0 border-b overflow-hidden"
      style={{
        maxHeight: '320px',
        borderColor: 'var(--content-border)',
        background: 'var(--content-surface)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--content-border)' }}
      >
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-4 w-4" style={{ color: '#6366F1' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            Compliance Gap Analysis
          </span>
          {result && (
            <div className="flex items-center gap-3 ml-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
              >
                {result.gaps.length} gap{result.gaps.length !== 1 ? 's' : ''}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}
              >
                {result.satisfied.length} satisfied
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="rounded p-1 transition-colors hover:bg-white/10"
              title="Re-analyze"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                style={{ color: 'var(--content-text-dim)' }}
              />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" style={{ color: 'var(--content-text-dim)' }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#6366F1' }} />
            <p className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
              Analyzing document compliance...
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <AlertTriangle className="h-5 w-5" style={{ color: '#f59e0b' }} />
            <p className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
              {error}
            </p>
            <button
              onClick={runAnalysis}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: '#6366F1', color: '#fff' }}
            >
              Try Again
            </button>
          </div>
        )}

        {result && (
          <div className="px-5 py-3 space-y-3">
            {/* Gaps */}
            {result.gaps.length > 0 && (
              <div className="space-y-2">
                {result.gaps.map((gap, i) => {
                  const sc = SEVERITY_COLORS[gap.severity] ?? SEVERITY_COLORS.minor;
                  return (
                    <div
                      key={i}
                      className="rounded-lg p-3 border"
                      style={{
                        borderColor: 'var(--content-border)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                          style={{ color: sc.text }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="font-mono text-[10px] font-bold"
                              style={{ color: 'var(--content-text-dim)' }}
                            >
                              {gap.clauseRef}
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {gap.severity}
                            </span>
                          </div>
                          <p
                            className="text-xs font-semibold mb-1"
                            style={{ color: 'var(--text)' }}
                          >
                            {gap.title}
                          </p>
                          <p
                            className="text-[11px] leading-relaxed"
                            style={{ color: 'var(--content-text-muted)' }}
                          >
                            {gap.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Satisfied — collapsible */}
            {result.satisfied.length > 0 && (
              <div>
                <button
                  onClick={() => setSatisfiedCollapsed((p) => !p)}
                  className="flex items-center gap-2 text-xs font-semibold mb-2 transition-colors"
                  style={{ color: '#4ade80' }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {satisfiedCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {result.satisfied.length} Satisfied Clause
                  {result.satisfied.length !== 1 ? 's' : ''}
                </button>
                {!satisfiedCollapsed && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {result.satisfied.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                        style={{ background: 'rgba(34,197,94,0.06)' }}
                      >
                        <CheckCircle2
                          className="h-3 w-3 flex-shrink-0"
                          style={{ color: '#4ade80' }}
                        />
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: 'var(--content-text-dim)' }}
                        >
                          {item.clauseRef}
                        </span>
                        <span
                          className="text-[11px] truncate"
                          style={{ color: 'var(--content-text-muted)' }}
                        >
                          {item.title}
                        </span>
                      </div>
                    ))}
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
