'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { capaApi } from '@/lib/api';
import type { CapaRecord, CapaStatus, FindingSeverity } from '@/lib/types';
import {
  CAPA_STATUS_LABELS,
  CAPA_STATUS_VARIANT,
  CAPA_SOURCE_TYPE_LABELS,
  ROOT_CAUSE_METHOD_LABELS,
  ISO_STANDARD_LABELS,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_VARIANT,
} from '@/lib/types';
import type { IsoStandard, RootCauseMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { AiRcaPanel } from '@/components/capa/ai-rca-panel';
import dynamic from 'next/dynamic';
import type { IshikawaCause } from '@/components/capa/ishikawa-diagram';

const IshikawaDiagram = dynamic(
  () => import('@/components/capa/ishikawa-diagram').then((m) => m.IshikawaDiagram),
  { ssr: false },
);

/**
 * Parse root cause analysis text/JSON into 6M Ishikawa categories.
 * Handles both structured JSON from Nexus and free-text RCA content.
 * Returns empty array on any failure — diagram shows empty state (never crashes).
 */
function parseCausesFromRCA(rca: string | object | null | undefined): IshikawaCause[] {
  if (!rca) return [];

  try {
    const text = typeof rca === 'string' ? rca : JSON.stringify(rca);

    // Try parsing as JSON first (Nexus structured output)
    try {
      const parsed = JSON.parse(text);

      // Format: { causes: [{ category, items }] }
      if (Array.isArray(parsed.causes)) {
        return parsed.causes
          .filter((c: { category?: string; items?: string[] }) => c.category && Array.isArray(c.items))
          .map((c: { category: string; items: string[] }) => ({
            category: c.category,
            items: c.items,
          }));
      }

      // Format: { "Man": ["cause1"], "Method": ["cause2"] }
      const KNOWN_CATEGORIES = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Mother Nature'];
      const mapped: IshikawaCause[] = [];
      for (const cat of KNOWN_CATEGORIES) {
        if (Array.isArray(parsed[cat]) && parsed[cat].length > 0) {
          mapped.push({ category: cat, items: parsed[cat] });
        }
      }
      if (mapped.length > 0) return mapped;
    } catch {
      // Not JSON — continue to text parsing
    }

    // Text heuristic: look for 6M category headers in the text
    const CATEGORY_PATTERNS: [string, RegExp][] = [
      ['Man',           /(?:^|\n)\s*\**\s*(?:man|people|personnel|human|staff)\s*[:—\-*]/im],
      ['Machine',       /(?:^|\n)\s*\**\s*(?:machine|equipment|tool|system|technology)\s*[:—\-*]/im],
      ['Method',        /(?:^|\n)\s*\**\s*(?:method|process|procedure|workflow)\s*[:—\-*]/im],
      ['Material',      /(?:^|\n)\s*\**\s*(?:material|supply|resource|input)\s*[:—\-*]/im],
      ['Measurement',   /(?:^|\n)\s*\**\s*(?:measurement|metric|monitoring|calibration|data)\s*[:—\-*]/im],
      ['Mother Nature', /(?:^|\n)\s*\**\s*(?:environment|mother nature|external|condition)\s*[:—\-*]/im],
    ];

    const results: IshikawaCause[] = [];
    for (const [category, pattern] of CATEGORY_PATTERNS) {
      const match = pattern.exec(text);
      if (match) {
        // Extract bullet points after the header until next header or end
        const startIdx = match.index + match[0].length;
        const rest = text.slice(startIdx);
        const nextHeader = /(?:^|\n)\s*\**\s*(?:man|machine|method|material|measurement|mother nature|environment|people|equipment|process|supply|metric)\s*[:—\-*]/im;
        const endMatch = nextHeader.exec(rest);
        const section = endMatch ? rest.slice(0, endMatch.index) : rest;

        const items = section
          .split(/\n/)
          .map((l) => l.replace(/^\s*[-*\d.]+\s*/, '').trim())
          .filter((l) => l.length > 2 && l.length < 200);

        if (items.length > 0) {
          results.push({ category, items: items.slice(0, 8) });
        }
      }
    }
    if (results.length > 0) return results;

    // Last resort: if there's substantial text but no structure, put everything under "Method"
    const lines = text
      .split(/\n/)
      .map((l) => l.replace(/^\s*[-*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 5 && l.length < 200);

    if (lines.length >= 2) {
      return [{ category: 'Method', items: lines.slice(0, 6) }];
    }
  } catch {
    // Never crash — return empty
  }

  return [];
}

const STATUS_TRANSITIONS: Partial<Record<CapaStatus, { next: CapaStatus; label: string }[]>> = {
  open: [{ next: 'in_progress', label: 'Start Work' }],
  in_progress: [{ next: 'pending_verification', label: 'Submit for Verification' }],
  pending_verification: [
    { next: 'closed', label: 'Verify & Close' },
    { next: 'in_progress', label: 'Return to Work' },
  ],
};

const API_METHOD_MAP: Record<string, string> = {
  five_why: '5why',
  fishbone: 'fishbone',
  eight_d: '8d',
};

export default function CapaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showRca, setShowRca] = useState(false);

  // Add action
  const [showAction, setShowAction] = useState(false);
  const [actionForm, setActionForm] = useState({ description: '', dueDate: '' });
  const [savingAction, setSavingAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await capaApi.get(id);
      setCapa(res.data as CapaRecord);
    } catch {
      setError('CAPA not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (newStatus: CapaStatus) => {
    setUpdating(true);
    try {
      await capaApi.setStatus(id, newStatus);
      await load();
    } catch {
      setError('Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAction(true);
    try {
      await capaApi.addAction(id, {
        description: actionForm.description.trim(),
        dueDate: new Date(actionForm.dueDate).toISOString(),
      });
      setShowAction(false);
      setActionForm({ description: '', dueDate: '' });
      await load();
    } catch {
      setError('Failed to add action.');
    } finally {
      setSavingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !capa) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/capa')} className="mb-4 flex items-center gap-1 text-sm" style={{ color: 'var(--content-text-dim)' }}>
          <ChevronLeft className="h-4 w-4" /> Back to CAPAs
        </button>
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'CAPA not found'}
        </div>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[capa.status] ?? [];
  const isOverdue = capa.dueDate && new Date(capa.dueDate) < new Date() && capa.status !== 'closed' && capa.status !== 'cancelled';

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/capa')}
        className="flex items-center gap-1 text-sm self-start transition-colors"
        style={{ color: 'var(--content-text-muted)' }}
      >
        <ChevronLeft className="h-4 w-4" /> Back to CAPAs
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <SentinelAvatar sentinelId="nexus" size={40} className="flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold line-clamp-2">{capa.problemDescription}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant={CAPA_STATUS_VARIANT[capa.status]}>
                {CAPA_STATUS_LABELS[capa.status]}
              </Badge>
              <Badge variant={FINDING_SEVERITY_VARIANT[capa.severity]}>
                {FINDING_SEVERITY_LABELS[capa.severity]}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {transitions.map((t) => (
            <Button
              key={t.next}
              onClick={() => handleStatusChange(t.next)}
              disabled={updating}
              size="sm"
              variant={t.next === 'closed' ? 'default' : 'outline'}
            >
              {t.next === 'closed' && <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
              {t.next === 'in_progress' && <Clock className="mr-1.5 h-3.5 w-3.5" />}
              {t.label}
            </Button>
          ))}
          {capa.status !== 'closed' && capa.status !== 'cancelled' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange('cancelled')}
              disabled={updating}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* Problem details */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--content-text-muted)' }}>
              Problem Description
            </h3>
            <p className="text-sm">{capa.problemDescription}</p>
          </div>

          {/* Root Cause Analysis */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                Root Cause Analysis — {ROOT_CAUSE_METHOD_LABELS[capa.rootCauseMethod]}
              </h3>
              {!showRca && !capa.rootCauseAnalysis && (
                <Button size="sm" variant="outline" onClick={() => setShowRca(true)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Analyse with Nexus
                </Button>
              )}
            </div>

            {capa.rootCauseAnalysis ? (
              <p className="text-sm">{capa.rootCauseAnalysis}</p>
            ) : showRca ? (
              <AiRcaPanel
                findingDescription={capa.problemDescription}
                clauseRef={capa.clauseRef}
                standard={capa.standard}
                method={(API_METHOD_MAP[capa.rootCauseMethod] ?? '5why') as '5why' | 'fishbone' | '8d'}
              />
            ) : (
              <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
                No root cause analysis yet. Use Nexus to guide analysis.
              </p>
            )}
          </div>

          {/* Ishikawa Diagram — additive, below RCA text */}
          {(capa.rootCauseAnalysis || showRca) && (
            <IshikawaDiagram
              problem={capa.problemDescription}
              causes={parseCausesFromRCA(capa.rootCauseAnalysis)}
              capaId={capa.id}
              standard={capa.standard}
              clauseRef={capa.clauseRef}
            />
          )}

          {/* Actions */}
          <div
            className="rounded-xl border"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--content-border)' }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                Actions ({capa.actionsJsonb?.length ?? 0})
              </span>
              <Button size="sm" variant="ghost" onClick={() => setShowAction(true)}>
                <Plus className="mr-1 h-3 w-3" /> Add Action
              </Button>
            </div>
            {(!capa.actionsJsonb || capa.actionsJsonb.length === 0) ? (
              <div className="py-6 text-center">
                <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
                  No actions defined yet
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--content-border)' }}>
                {capa.actionsJsonb.map((action, i) => (
                  <div key={action.id ?? i} className="flex items-start gap-3 px-4 py-3">
                    <Badge
                      variant={action.status === 'completed' ? 'success' : action.status === 'in_progress' ? 'warning' : 'secondary'}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {action.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{action.description}</p>
                      {action.dueDate && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-muted)' }}>
                          Due: {new Date(action.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              Details
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Source</span>
                <span>{CAPA_SOURCE_TYPE_LABELS[capa.sourceType]}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Standard</span>
                <span>{ISO_STANDARD_LABELS[capa.standard as IsoStandard] ?? capa.standard}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Clause</span>
                <span>{capa.clauseRef || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Method</span>
                <span>{ROOT_CAUSE_METHOD_LABELS[capa.rootCauseMethod as RootCauseMethod]}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Due Date</span>
                <span style={{ color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 600 : 400 }}>
                  {new Date(capa.dueDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Created</span>
                <span>{new Date(capa.createdAt).toLocaleDateString()}</span>
              </div>
              {capa.closedDate && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--content-text-muted)' }}>Closed</span>
                  <span>{new Date(capa.closedDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Verification */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              Effectiveness Verification
            </h3>
            {capa.effectivenessVerified ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" />
                Verified {capa.effectivenessVerifiedAt ? new Date(capa.effectivenessVerifiedAt).toLocaleDateString() : ''}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>Not yet verified</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Action Modal */}
      <Modal
        open={showAction}
        onOpenChange={(o) => { setShowAction(o); if (!o) setActionForm({ description: '', dueDate: '' }); }}
        title="Add Action"
      >
        <form onSubmit={handleAddAction} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Description *</label>
            <textarea
              required
              rows={3}
              value={actionForm.description}
              onChange={(e) => setActionForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the corrective or preventive action…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Due Date *</label>
            <input
              type="date"
              required
              value={actionForm.dueDate}
              onChange={(e) => setActionForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowAction(false)}>Cancel</Button>
            <Button type="submit" disabled={savingAction}>
              {savingAction ? 'Adding…' : 'Add Action'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
