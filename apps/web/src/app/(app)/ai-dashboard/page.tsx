'use client';

import { useState } from 'react';
import { aiApi } from '@/lib/api';
import { Bot, Sparkles, AlertTriangle, CheckCircle2, XCircle, Loader2, ChevronRight, BarChart2 } from 'lucide-react';

type Mode = 'qms' | 'ohs';

interface AnalysisResult {
  gaps?: string[];
  recommendations?: string[];
  complianceScore?: number;
  hazards?: Array<{ hazard: string; severity: string; likelihood: string; controls: string[] }>;
  overallRiskRating?: string;
}

const SEV_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  HIGH:   { bg: 'rgba(220,38,38,0.06)', color: '#dc2626', border: 'rgba(220,38,38,0.2)' },
  MEDIUM: { bg: 'rgba(217,119,6,0.06)', color: '#d97706', border: 'rgba(217,119,6,0.2)' },
  LOW:    { bg: 'rgba(22,163,74,0.06)', color: '#16a34a', border: 'rgba(22,163,74,0.2)' },
};

const FIELD = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function AiDashboardPage() {
  const [mode, setMode] = useState<Mode>('qms');
  const [input, setInput] = useState('');
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setResult(null);
    try {
      if (mode === 'qms') {
        const res = await aiApi.gapDetect({
          standards: [extra || 'iso_9001'],
          existingControls: [],
          auditResults: [],
        });
        setResult(res.data as AnalysisResult);
      } else {
        const res = await aiApi.documentGenerate({
          documentType: 'hazard_identification',
          standards: ['iso_45001'],
          orgContext: input,
          sections: ['hazards'],
        });
        setResult(res.data as AnalysisResult);
      }
    } catch {
      setError('Analysis failed. Verify the backend is running and AI credentials are configured.');
    }
    setLoading(false);
  };

  const scoreColor = (score?: number) => {
    if (!score) return 'var(--muted)';
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#d97706';
    return '#dc2626';
  };

  return (
    <div className="p-8 max-w-4xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text)' }}>AI Sentinels</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>AI-powered compliance gap analysis and hazard identification</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface)' }}>
        {([['qms', 'QMS Gap Analysis', BarChart2], ['ohs', 'OHS Hazard ID', AlertTriangle]] as [Mode, string, React.ElementType][]).map(([m, label, Icon]) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); setInput(''); setExtra(''); }}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={mode === m
              ? { background: 'var(--card-bg)', color: 'var(--text)', boxShadow: 'var(--card-shadow)' }
              : { color: 'var(--muted)', background: 'transparent' }}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleAnalyze} className="rounded-xl p-6 space-y-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            {mode === 'qms' ? 'Document / Process Content' : 'Activity Description'}
          </label>
          <textarea required value={input} onChange={e => setInput(e.target.value)} rows={7}
            placeholder={mode === 'qms'
              ? 'Paste your procedure, policy, or process description here…'
              : 'Describe the work activity (e.g. "Operating a forklift in the warehouse to move pallets")…'}
            className={FIELD} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--input-bg)', resize: 'vertical' }} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            {mode === 'qms' ? 'Standard (optional)' : 'Location (optional)'}
          </label>
          <input value={extra} onChange={e => setExtra(e.target.value)}
            placeholder={mode === 'qms' ? 'e.g. ISO 9001:2015' : 'e.g. Warehouse Floor 2'}
            className={FIELD} style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--input-bg)' }} />
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Sparkles className="h-4 w-4" /> Run Analysis</>}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>

          {/* Score header */}
          <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(37,99,235,0.08)' }}>
                <Bot className="h-5 w-5" style={{ color: '#2563eb' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Analysis Complete</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Powered by Gemini AI</p>
              </div>
            </div>
            {mode === 'qms' && result.complianceScore !== undefined && (
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: scoreColor(result.complianceScore) }}>{result.complianceScore}%</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Compliance Score</p>
              </div>
            )}
            {mode === 'ohs' && result.overallRiskRating && (
              <span className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={SEV_STYLE[result.overallRiskRating] ?? { bg: 'var(--surface)', color: 'var(--text)', border: 'var(--border)' }}>
                {result.overallRiskRating} Risk
              </span>
            )}
          </div>

          {/* QMS Results */}
          {mode === 'qms' && (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {result.gaps && result.gaps.length > 0 && (
                <div className="px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#dc2626' }}>
                    Compliance Gaps ({result.gaps.length})
                  </p>
                  <ul className="space-y-2">
                    {result.gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text)' }}>
                        <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#16a34a' }}>
                    Recommendations ({result.recommendations.length})
                  </p>
                  <ul className="space-y-2">
                    {result.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text)' }}>
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* OHS Results */}
          {mode === 'ohs' && result.hazards && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
                Identified Hazards ({result.hazards.length})
              </p>
              {result.hazards.map((h, i) => {
                const sev = SEV_STYLE[h.severity] ?? SEV_STYLE.LOW;
                return (
                  <div key={i} className="rounded-xl p-4" style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{h.hazard}</p>
                      <span className="flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--card-bg)', color: sev.color, border: `1px solid ${sev.border}` }}>
                        {h.severity}
                      </span>
                    </div>
                    {h.controls.length > 0 && (
                      <ul className="space-y-1 mt-3 pt-3" style={{ borderTop: `1px solid ${sev.border}` }}>
                        {h.controls.map((c, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <ChevronRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: sev.color }} /> {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
