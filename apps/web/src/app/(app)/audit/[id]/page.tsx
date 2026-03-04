'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { auditApi, aiApi } from '@/lib/api';
import type { AuditSession, AuditFinding, FindingSeverity } from '@/lib/types';
import {
  AUDIT_TYPE_LABELS,
  AUDIT_STATUS_LABELS,
  AUDIT_STATUS_VARIANT,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_VARIANT,
  FINDING_STATUS_LABELS,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Audie } from '@/components/sentinels/audie';
import { AiExaminePanel } from '@/components/audit/ai-examine-panel';

const SEVERITIES = Object.entries(FINDING_SEVERITY_LABELS) as [FindingSeverity, string][];

export default function AuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [session, setSession] = useState<AuditSession | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add finding modal
  const [showFinding, setShowFinding] = useState(false);
  const [findingForm, setFindingForm] = useState({
    clauseRef: '',
    standard: 'iso_9001',
    severity: 'minor_nc' as FindingSeverity,
    description: '',
  });
  const [savingFinding, setSavingFinding] = useState(false);

  // AI examine
  const [examineClause, setExamineClause] = useState('');
  const [examineStandard, setExamineStandard] = useState('iso_9001');
  const [showExamine, setShowExamine] = useState(false);

  // AI report
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.get(id);
      const data = res.data as { session: AuditSession; findings: AuditFinding[] };
      setSession(data.session);
      setFindings(data.findings ?? []);
    } catch {
      setError('Audit session not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAddFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFinding(true);
    try {
      await auditApi.addFinding(id, {
        clauseRef: findingForm.clauseRef.trim(),
        standard: findingForm.standard,
        severity: findingForm.severity,
        description: findingForm.description.trim(),
      });
      setShowFinding(false);
      setFindingForm({ clauseRef: '', standard: 'iso_9001', severity: 'minor_nc', description: '' });
      await load();
    } catch {
      setError('Failed to add finding.');
    } finally {
      setSavingFinding(false);
    }
  };

  const handleAiFinding = async (finding: {
    clauseRef: string; standard: string; severity: FindingSeverity; description: string;
  }) => {
    try {
      await auditApi.addFinding(id, finding);
      await load();
    } catch {
      // silently fail — finding shown in UI anyway
    }
  };

  const handleGenerateReport = async () => {
    if (!session) return;
    setGeneratingReport(true);
    setError(null);
    try {
      const res = await aiApi.auditReport({
        sessionId: session.id,
        findings: findings.map((f) => ({
          clause: f.clauseRef,
          standard: f.standard,
          type: f.severity,
          description: f.description,
        })),
        scope: session.scope,
        standards: session.clauseRefs.length > 0 ? session.clauseRefs : ['iso_9001'],
        auditDate: session.auditDate,
      });
      const data = res.data as { reportMarkdown: string };
      setReportMarkdown(data.reportMarkdown);
      setShowReport(true);
    } catch {
      setError('Audie could not generate the report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/audit')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> Back to Audits
        </button>
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'Audit not found'}
        </div>
      </div>
    );
  }

  const findingSummary = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/audit')}
        className="flex items-center gap-1 text-sm self-start transition-colors"
        style={{ color: 'var(--content-text-muted)' }}
      >
        <ChevronLeft className="h-4 w-4" /> Back to Audits
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Audie size={40} className="flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold">{session.title}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant={AUDIT_STATUS_VARIANT[session.status]}>
                {AUDIT_STATUS_LABELS[session.status]}
              </Badge>
              <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                {AUDIT_TYPE_LABELS[session.auditType]}
              </span>
              <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                {new Date(session.auditDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={handleGenerateReport} disabled={generatingReport || findings.length === 0} size="sm">
            {generatingReport ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            {generatingReport ? 'Generating…' : 'AI Report'}
          </Button>
          <Button variant="outline" onClick={() => setShowFinding(true)} size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Finding
          </Button>
        </div>
      </div>

      {/* Scope + Summary stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--content-text-muted)' }}>
            Scope
          </h3>
          <p className="text-sm">{session.scope}</p>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--content-text-muted)' }}>
            Findings Summary
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SEVERITIES.map(([sev, label]) => (
              <div key={sev} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5">
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-sm font-bold">{findingSummary[sev] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Examine section */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            AI Clause Examination
          </h3>
        </div>

        {!showExamine ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={examineClause}
              onChange={(e) => setExamineClause(e.target.value)}
              placeholder="Clause (e.g. 8.4.1)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 w-32"
            />
            <select
              value={examineStandard}
              onChange={(e) => setExamineStandard(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            >
              <option value="iso_9001">ISO 9001</option>
              <option value="iso_14001">ISO 14001</option>
              <option value="iso_45001">ISO 45001</option>
            </select>
            <Button
              onClick={() => { if (examineClause.trim()) setShowExamine(true); }}
              disabled={!examineClause.trim()}
              size="sm"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Examine with Audie
            </Button>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowExamine(false); setExamineClause(''); }}>
                Close Examination
              </Button>
            </div>
            <AiExaminePanel
              clause={examineClause}
              standard={examineStandard}
              auditContext={session.scope}
              onFindingDetected={handleAiFinding}
            />
          </div>
        )}
      </div>

      {/* Findings list */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            Findings ({findings.length})
          </span>
        </div>

        {findings.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
              No findings yet. Use AI Examination or add findings manually.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--content-border)' }}>
            {findings.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-4 py-3">
                <Badge variant={FINDING_SEVERITY_VARIANT[f.severity]} className="flex-shrink-0 mt-0.5">
                  {FINDING_SEVERITY_LABELS[f.severity]}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--content-text-muted)' }}>
                    {f.clauseRef} · {f.standard.replace('_', ' ').toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-sm">{f.description}</p>
                </div>
                <Badge variant={f.status === 'closed' ? 'outline' : f.status === 'in_capa' ? 'warning' : 'secondary'}>
                  {FINDING_STATUS_LABELS[f.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Finding Modal */}
      <Modal
        open={showFinding}
        onOpenChange={(o) => { setShowFinding(o); if (!o) setFindingForm({ clauseRef: '', standard: 'iso_9001', severity: 'minor_nc', description: '' }); }}
        title="Add Finding"
      >
        <form onSubmit={handleAddFinding} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Clause Ref *</label>
              <input
                type="text"
                required
                value={findingForm.clauseRef}
                onChange={(e) => setFindingForm((f) => ({ ...f, clauseRef: e.target.value }))}
                placeholder="e.g. 8.4.1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Standard *</label>
              <select
                required
                value={findingForm.standard}
                onChange={(e) => setFindingForm((f) => ({ ...f, standard: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
              >
                <option value="iso_9001">ISO 9001</option>
                <option value="iso_14001">ISO 14001</option>
                <option value="iso_45001">ISO 45001</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Severity *</label>
            <select
              required
              value={findingForm.severity}
              onChange={(e) => setFindingForm((f) => ({ ...f, severity: e.target.value as FindingSeverity }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            >
              {SEVERITIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
            <textarea
              required
              rows={3}
              value={findingForm.description}
              onChange={(e) => setFindingForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the finding…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowFinding(false)}>Cancel</Button>
            <Button type="submit" disabled={savingFinding}>
              {savingFinding ? 'Adding…' : 'Add Finding'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI Report Modal */}
      <Modal
        open={showReport}
        onOpenChange={setShowReport}
        title=""
        className="max-w-2xl"
      >
        <div className="mb-4 flex items-center justify-between -mt-2">
          <div className="flex items-center gap-3">
            <Audie size={32} />
            <h2 className="text-lg font-semibold text-gray-900">Audit Report — ISO 19011:6.5</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyReport}>
            {copiedReport ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
            {copiedReport ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
            {reportMarkdown}
          </pre>
        </div>
      </Modal>
    </div>
  );
}
