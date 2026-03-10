'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import { capaApi } from '@/lib/api';
import type {
  CapaRecord,
  CapaSourceType,
  FindingSeverity,
  RootCauseMethod,
  IsoStandard,
} from '@/lib/types';
import {
  CAPA_STATUS_LABELS,
  CAPA_SOURCE_TYPE_LABELS,
  ROOT_CAUSE_METHOD_LABELS,
  ISO_STANDARD_LABELS,
  FINDING_SEVERITY_LABELS,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  SentinelPageHero,
  PrimaryButton,
  SadewaEmptyState,
  SectionLabel,
  ContentCard,
  PageSkeleton,
} from '@/components/ui/sentinel-page-hero';

const SOURCE_TYPES = Object.entries(CAPA_SOURCE_TYPE_LABELS) as [CapaSourceType, string][];
const SEVERITIES = Object.entries(FINDING_SEVERITY_LABELS) as [FindingSeverity, string][];
const ROOT_METHODS = Object.entries(ROOT_CAUSE_METHOD_LABELS) as [RootCauseMethod, string][];
const ISO_STANDARDS = Object.entries(ISO_STANDARD_LABELS) as [IsoStandard, string][];

const STATUS_COLORS: Record<string, string> = {
  open: '#F59E0B',
  in_progress: '#3B82F6',
  pending_verification: '#8B5CF6',
  closed: '#22C55E',
  cancelled: '#6b7280',
};

const SEVERITY_COLORS: Record<string, string> = {
  major_nc: '#EF4444',
  minor_nc: '#F59E0B',
  observation: '#3B82F6',
  opportunity: '#22C55E',
};

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
  problemDescription: '', sourceType: 'nonconformity', standard: 'iso_9001',
  clauseRef: '', severity: 'minor_nc', rootCauseMethod: 'five_why',
  rootCauseAnalysis: '', dueDate: '',
};

export default function CapaPage() {
  const router = useRouter();
  const [capas, setCapas] = useState<CapaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateCapaForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capaApi.list();
      setCapas(Array.isArray(res.data) ? res.data as CapaRecord[] : []);
    } catch {
      setCapas([]);
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
        sourceType: form.sourceType,
        standard: form.standard,
        clauseRef: form.clauseRef.trim(),
        severity: form.severity,
        rootCauseMethod: form.rootCauseMethod,
        rootCauseAnalysis: form.rootCauseAnalysis.trim() || undefined,
        dueDate: new Date(form.dueDate).toISOString(),
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const filtered = capas.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.problemDescription.toLowerCase().includes(q);
  });

  const isOverdue = (c: CapaRecord) =>
    !!c.dueDate && new Date(c.dueDate) < new Date() && c.status !== 'closed' && c.status !== 'cancelled';

  /* Stats for hero */
  const openCount = capas.filter((c) => c.status === 'open' || c.status === 'in_progress').length;
  const closedCount = capas.filter((c) => c.status === 'closed').length;
  const overdueCount = capas.filter(isOverdue).length;

  return (
    <div className="p-6 max-w-[1280px]">
      {/* ── Hero ── */}
      <SentinelPageHero
        sectionLabel="CAPA ENGINE"
        title="Identify. Correct. Prevent."
        subtitle="Nexus drives corrective and preventive actions with AI-guided root cause analysis."
        sentinelColor="#8B5CF6"
        stats={
          loading
            ? undefined
            : [
                { value: String(openCount), label: 'Open' },
                { value: String(closedCount), label: 'Closed' },
                { value: String(overdueCount), label: 'Overdue' },
              ]
        }
      />

      {/* ── Section label + actions ── */}
      <div className="flex items-center justify-between mb-6">
        <SectionLabel>ALL CAPAs</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#4b5563' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search CAPAs..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New CAPA
          </PrimaryButton>
        </div>
      </div>

      {/* ── Content ── */}
      <ContentCard>
        {loading ? (
          <PageSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={capas.length === 0 ? 'No CAPAs yet' : 'No matching CAPAs'}
            description={
              capas.length === 0
                ? 'Track corrective and preventive actions with AI-guided root cause analysis.'
                : 'Try adjusting your search query.'
            }
            action={
              capas.length === 0 ? (
                <PrimaryButton onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" /> New CAPA
                </PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            {filtered.map((c, i) => (
              <div
                key={c.id}
                onClick={() => router.push(`/capa/${c.id}`)}
                className="flex items-center gap-4 px-4 py-4 cursor-pointer transition-colors hover:bg-white/5"
              >
                {/* Number */}
                <span
                  className="text-[12px] font-semibold font-heading w-8 flex-shrink-0"
                  style={{ color: 'rgba(255,255,255,0.15)' }}
                >
                  /{String(i + 1).padStart(2, '0')}
                </span>

                {/* Problem */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{c.problemDescription}</p>
                  <p className="text-[11px]" style={{ color: '#6b7280' }}>
                    {CAPA_SOURCE_TYPE_LABELS[c.sourceType]}
                  </p>
                </div>

                {/* Severity */}
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                  style={{
                    color: SEVERITY_COLORS[c.severity] ?? '#6b7280',
                    background: `${SEVERITY_COLORS[c.severity] ?? '#6b7280'}1a`,
                  }}
                >
                  {FINDING_SEVERITY_LABELS[c.severity]}
                </span>

                {/* Status */}
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                  style={{
                    color: STATUS_COLORS[c.status] ?? '#6b7280',
                    background: `${STATUS_COLORS[c.status] ?? '#6b7280'}1a`,
                  }}
                >
                  {CAPA_STATUS_LABELS[c.status] ?? c.status}
                </span>

                {/* Due date */}
                <span
                  className="text-[12px] flex-shrink-0 w-24 text-right"
                  style={{
                    color: isOverdue(c) ? '#EF4444' : '#6b7280',
                    fontWeight: isOverdue(c) ? 600 : 400,
                  }}
                >
                  {c.dueDate
                    ? new Date(c.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '\u2014'}
                </span>

                <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#4b5563' }} />
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* ── Create CAPA Modal ── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New CAPA"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Problem Description</label>
            <textarea
              required
              rows={3}
              value={form.problemDescription}
              onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))}
              placeholder="Describe the nonconformity or issue..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: '#fff' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Source</label>
              <select required value={form.sourceType} onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value as CapaSourceType }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }}>
                {SOURCE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Severity</label>
              <select required value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as FindingSeverity }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }}>
                {SEVERITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Standard</label>
              <select required value={form.standard} onChange={(e) => setForm((f) => ({ ...f, standard: e.target.value as IsoStandard }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }}>
                {ISO_STANDARDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Clause Ref</label>
              <input type="text" value={form.clauseRef} onChange={(e) => setForm((f) => ({ ...f, clauseRef: e.target.value }))} placeholder="e.g. 8.4.1" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>RCA Method</label>
              <select value={form.rootCauseMethod} onChange={(e) => setForm((f) => ({ ...f, rootCauseMethod: e.target.value as RootCauseMethod }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }}>
                {ROOT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Due Date</label>
              <input type="date" required value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create CAPA'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
