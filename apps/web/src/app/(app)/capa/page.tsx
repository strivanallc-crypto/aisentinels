'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, AlertCircle } from 'lucide-react';
import { capaApi } from '@/lib/api';
import type { CapaRecord, CapaSourceType, FindingSeverity, RootCauseMethod, IsoStandard } from '@/lib/types';
import {
  CAPA_STATUS_LABELS,
  CAPA_STATUS_VARIANT,
  CAPA_SOURCE_TYPE_LABELS,
  ROOT_CAUSE_METHOD_LABELS,
  ISO_STANDARD_LABELS,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SOURCE_TYPES  = Object.entries(CAPA_SOURCE_TYPE_LABELS) as [CapaSourceType, string][];
const SEVERITIES    = Object.entries(FINDING_SEVERITY_LABELS) as [FindingSeverity, string][];
const ROOT_METHODS  = Object.entries(ROOT_CAUSE_METHOD_LABELS) as [RootCauseMethod, string][];
const ISO_STANDARDS = Object.entries(ISO_STANDARD_LABELS) as [IsoStandard, string][];

interface CreateCapaForm {
  problemDescription: string;
  sourceType: CapaSourceType;
  standard: IsoStandard;
  clauseRef: string;
  severity: FindingSeverity;
  rootCauseMethod: RootCauseMethod;
  rootCauseAnalysis: string;
  dueDate: string;
}

const EMPTY_FORM: CreateCapaForm = {
  problemDescription: '',
  sourceType:         'nonconformity',
  standard:           'iso_9001',
  clauseRef:          '',
  severity:           'minor_nc',
  rootCauseMethod:    'five_why',
  rootCauseAnalysis:  '',
  dueDate:            '',
};

export default function CapaPage() {
  const [capas, setCapas]           = useState<CapaRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState<CreateCapaForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await capaApi.list();
      setCapas(res.data as CapaRecord[]);
    } catch {
      setError('Failed to load CAPAs. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.problemDescription.trim() || !form.dueDate) return;
    setSaving(true);
    try {
      await capaApi.create({
        problemDescription: form.problemDescription.trim(),
        sourceType:         form.sourceType,
        standard:           form.standard,
        clauseRef:          form.clauseRef.trim(),
        severity:           form.severity,
        rootCauseMethod:    form.rootCauseMethod,
        rootCauseAnalysis:  form.rootCauseAnalysis.trim() || undefined,
        dueDate:            new Date(form.dueDate).toISOString(),
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setError('Failed to create CAPA.');
    } finally {
      setSaving(false);
    }
  };

  const isOverdue = (capa: CapaRecord) =>
    !!capa.dueDate &&
    new Date(capa.dueDate) < new Date() &&
    capa.status !== 'closed' &&
    capa.status !== 'cancelled';

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › CAPA Hub
          </p>
          <h1 className="mt-1 text-2xl font-bold">CAPA Hub</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Corrective and preventive action management — ISO 9001 Clause 10.2
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New CAPA
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

      {/* ── Table / Loading / Empty ───────────────────────────────── */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : capas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <Wrench className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold">No CAPAs yet</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                Track corrective and preventive actions
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="mt-1">
              <Plus className="mr-1.5 h-4 w-4" /> New CAPA
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Problem', 'Source', 'Severity', 'Status', 'Due Date'].map((h) => (
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
              {capas.map((c, i) => (
                <tr
                  key={c.id}
                  className="transition-colors hover:bg-gray-50"
                  style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 flex-shrink-0 text-amber-400" />
                      <span className="line-clamp-1 font-medium">{c.problemDescription}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    {CAPA_SOURCE_TYPE_LABELS[c.sourceType] ?? c.sourceType}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={FINDING_SEVERITY_VARIANT[c.severity]}>
                      {FINDING_SEVERITY_LABELS[c.severity] ?? c.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={CAPA_STATUS_VARIANT[c.status]}>
                      {CAPA_STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span style={{ color: isOverdue(c) ? '#dc2626' : 'var(--content-text-muted)', fontWeight: isOverdue(c) ? 600 : 400 }}>
                      {new Date(c.dueDate).toLocaleDateString()}
                    </span>
                    {isOverdue(c) && (
                      <span className="ml-1.5 rounded bg-red-50 px-1 py-0.5 text-[10px] text-red-600">
                        Overdue
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create CAPA Modal ─────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New CAPA"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {/* Problem Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Problem Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.problemDescription}
              onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))}
              placeholder="Describe the nonconformity or issue in detail…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Source Type + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Source <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.sourceType}
                onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value as CapaSourceType }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {SOURCE_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as FindingSeverity }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {SEVERITIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Standard + Clause Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Standard <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.standard}
                onChange={(e) => setForm((f) => ({ ...f, standard: e.target.value as IsoStandard }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {ISO_STANDARDS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Clause Ref{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={form.clauseRef}
                onChange={(e) => setForm((f) => ({ ...f, clauseRef: e.target.value }))}
                placeholder="e.g. 8.4.1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Root Cause Method */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Root Cause Method
            </label>
            <select
              value={form.rootCauseMethod}
              onChange={(e) => setForm((f) => ({ ...f, rootCauseMethod: e.target.value as RootCauseMethod }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {ROOT_METHODS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Root Cause Analysis */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Root Cause Analysis{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={form.rootCauseAnalysis}
              onChange={(e) => setForm((f) => ({ ...f, rootCauseAnalysis: e.target.value }))}
              placeholder="Summarise the root cause findings…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create CAPA'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
