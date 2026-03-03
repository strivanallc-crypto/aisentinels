'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { ClipboardCheck, Plus, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { auditApi } from '@/lib/api';
import type { AuditSession, AuditFinding, AuditType, FindingSeverity } from '@/lib/types';
import {
  AUDIT_TYPE_LABELS,
  AUDIT_STATUS_LABELS,
  AUDIT_STATUS_VARIANT,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const AUDIT_TYPES = Object.entries(AUDIT_TYPE_LABELS) as [AuditType, string][];
const SEVERITIES = Object.entries(FINDING_SEVERITY_LABELS) as [FindingSeverity, string][];

interface CreateAuditForm {
  title: string;
  auditType: AuditType;
  scope: string;
  auditDate: string;
}

interface CreateFindingForm {
  clauseRef: string;
  standard: string;
  severity: FindingSeverity;
  description: string;
}

const EMPTY_AUDIT: CreateAuditForm = {
  title: '', auditType: 'internal', scope: '', auditDate: '',
};
const EMPTY_FINDING: CreateFindingForm = {
  clauseRef: '', standard: 'iso_9001', severity: 'minor_nc', description: '',
};

export default function AuditPage() {
  const [sessions, setSessions]       = useState<AuditSession[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [auditForm, setAuditForm]     = useState<CreateAuditForm>(EMPTY_AUDIT);
  const [saving, setSaving]           = useState(false);

  // Finding panel
  const [selected, setSelected]           = useState<AuditSession | null>(null);
  const [findings, setFindings]           = useState<AuditFinding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [showFinding, setShowFinding]     = useState(false);
  const [findingForm, setFindingForm]     = useState<CreateFindingForm>(EMPTY_FINDING);
  const [savingFinding, setSavingFinding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.list();
      setSessions(res.data as AuditSession[]);
    } catch {
      setError('Failed to load audits. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelectSession = async (session: AuditSession) => {
    if (selected?.id === session.id) {
      setSelected(null);
      setFindings([]);
      return;
    }
    setSelected(session);
    setLoadingFindings(true);
    try {
      const res = await auditApi.get(session.id);
      const data = res.data as { session: AuditSession; findings: AuditFinding[] };
      setFindings(data.findings ?? []);
    } catch {
      setFindings([]);
    } finally {
      setLoadingFindings(false);
    }
  };

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditForm.title.trim() || !auditForm.scope.trim() || !auditForm.auditDate) return;
    setSaving(true);
    try {
      await auditApi.create({
        title:     auditForm.title.trim(),
        auditType: auditForm.auditType,
        scope:     auditForm.scope.trim(),
        auditDate: new Date(auditForm.auditDate).toISOString(),
      });
      setShowCreate(false);
      setAuditForm(EMPTY_AUDIT);
      await load();
    } catch {
      setError('Failed to schedule audit.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingFinding(true);
    try {
      await auditApi.addFinding(selected.id, {
        clauseRef:   findingForm.clauseRef.trim(),
        standard:    findingForm.standard,
        severity:    findingForm.severity,
        description: findingForm.description.trim(),
      });
      setShowFinding(false);
      setFindingForm(EMPTY_FINDING);
      // Reload findings for selected session
      const res = await auditApi.get(selected.id);
      const data = res.data as { session: AuditSession; findings: AuditFinding[] };
      setFindings(data.findings ?? []);
    } catch {
      setError('Failed to add finding.');
    } finally {
      setSavingFinding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Audit Command
          </p>
          <h1 className="mt-1 text-2xl font-bold">Audit Command</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Plan & track internal/external audits — ISO 9001 Clause 9.2
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Schedule Audit
        </Button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={load}
            className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Sessions Table ────────────────────────────────────────── */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <ClipboardCheck className="h-7 w-7 text-green-500" />
            </div>
            <div>
              <p className="font-semibold">No audits yet</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                Schedule your first audit session
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="mt-1">
              <Plus className="mr-1.5 h-4 w-4" /> Schedule Audit
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Title', 'Type', 'Scope', 'Status', 'Audit Date', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--content-text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <Fragment key={s.id}>
                  <tr
                    onClick={() => handleSelectSession(s)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 flex-shrink-0 text-green-400" />
                        <span className="font-medium">{s.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--content-text-muted)' }}>
                      {AUDIT_TYPE_LABELS[s.auditType] ?? s.auditType}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                      {s.scope}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={AUDIT_STATUS_VARIANT[s.status]}>
                        {AUDIT_STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                      {new Date(s.auditDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {selected?.id === s.id
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-300" />
                      }
                    </td>
                  </tr>

                  {/* ── Findings panel (inline expansion) ─────────── */}
                  {selected?.id === s.id && (
                    <tr key={`${s.id}-findings`}>
                      <td colSpan={6} className="px-4 pb-4 pt-0">
                        <div
                          className="rounded-lg border p-4"
                          style={{ borderColor: 'var(--content-border)', background: 'var(--content-bg)' }}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                              Findings
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowFinding(true); }}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              <Plus className="h-3 w-3" /> Add Finding
                            </button>
                          </div>

                          {loadingFindings ? (
                            <p className="text-xs text-gray-400">Loading…</p>
                          ) : findings.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                              No findings recorded yet.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {findings.map((f) => (
                                <div
                                  key={f.id}
                                  className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm"
                                  style={{ borderColor: 'var(--content-border)' }}
                                >
                                  <Badge variant={FINDING_SEVERITY_VARIANT[f.severity]} className="flex-shrink-0">
                                    {FINDING_SEVERITY_LABELS[f.severity]}
                                  </Badge>
                                  <div className="flex-1">
                                    <p className="text-xs font-medium" style={{ color: 'var(--content-text-muted)' }}>
                                      {f.clauseRef} · {f.standard.replace('_', ' ').toUpperCase()}
                                    </p>
                                    <p className="mt-0.5">{f.description}</p>
                                  </div>
                                  <Badge variant={f.status === 'closed' ? 'outline' : f.status === 'in_capa' ? 'warning' : 'secondary'}>
                                    {f.status === 'open' ? 'Open' : f.status === 'in_capa' ? 'In CAPA' : 'Closed'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Schedule Audit Modal ──────────────────────────────────── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setAuditForm(EMPTY_AUDIT); }}
        title="Schedule Audit"
      >
        <form onSubmit={handleCreateAudit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Audit Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={auditForm.title}
              onChange={(e) => setAuditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Annual ISO 9001 Internal Audit"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={auditForm.auditType}
                onChange={(e) => setAuditForm((f) => ({ ...f, auditType: e.target.value as AuditType }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {AUDIT_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Audit Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={auditForm.auditDate}
                onChange={(e) => setAuditForm((f) => ({ ...f, auditDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Scope <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={auditForm.scope}
              onChange={(e) => setAuditForm((f) => ({ ...f, scope: e.target.value }))}
              placeholder="Describe what will be covered in this audit…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowCreate(false); setAuditForm(EMPTY_AUDIT); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Scheduling…' : 'Schedule Audit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Add Finding Modal ─────────────────────────────────────── */}
      <Modal
        open={showFinding}
        onOpenChange={(o) => { setShowFinding(o); if (!o) setFindingForm(EMPTY_FINDING); }}
        title={`Add Finding — ${selected?.title ?? ''}`}
      >
        <form onSubmit={handleAddFinding} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Clause Ref <span className="text-red-500">*</span>
              </label>
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Standard <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={findingForm.standard}
                onChange={(e) => setFindingForm((f) => ({ ...f, standard: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="iso_9001">ISO 9001</option>
                <option value="iso_14001">ISO 14001</option>
                <option value="iso_45001">ISO 45001</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Severity <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={findingForm.severity}
              onChange={(e) => setFindingForm((f) => ({ ...f, severity: e.target.value as FindingSeverity }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {SEVERITIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={findingForm.description}
              onChange={(e) => setFindingForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the finding in detail…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowFinding(false); setFindingForm(EMPTY_FINDING); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingFinding}>
              {savingFinding ? 'Adding…' : 'Add Finding'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
