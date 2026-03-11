'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Plus, ArrowUpRight } from 'lucide-react';
import { auditApi } from '@/lib/api';
import type { AuditSession, AuditType, AuditSessionStatus } from '@/lib/types';
import { AUDIT_TYPE_LABELS, AUDIT_STATUS_LABELS } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  SentinelPageHero,
  PrimaryButton,
  SecondaryButton,
  SadewaEmptyState,
  SectionLabel,
  ContentCard,
  PageSkeleton,
} from '@/components/ui/sentinel-page-hero';
import { AiPlanModal } from '@/components/audit/ai-plan-modal';

const AUDIT_TYPES = Object.entries(AUDIT_TYPE_LABELS) as [AuditType, string][];

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#22C55E',
  cancelled: '#6b7280',
};

interface CreateAuditForm {
  title: string;
  auditType: AuditType;
  scope: string;
  auditDate: string;
}

const EMPTY_AUDIT: CreateAuditForm = {
  title: '', auditType: 'internal', scope: '', auditDate: '',
};

export default function AuditPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [auditForm, setAuditForm] = useState<CreateAuditForm>(EMPTY_AUDIT);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list();
      setSessions(Array.isArray(res.data) ? res.data as AuditSession[] : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditForm.title.trim() || !auditForm.scope.trim() || !auditForm.auditDate) return;
    setSaving(true);
    try {
      await auditApi.create({
        title: auditForm.title.trim(),
        auditType: auditForm.auditType,
        scope: auditForm.scope.trim(),
        auditDate: new Date(auditForm.auditDate).toISOString(),
      });
      setShowCreate(false);
      setAuditForm(EMPTY_AUDIT);
      await load();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.scope.toLowerCase().includes(q);
  });

  /* Stats for hero */
  const scheduledCount = sessions.filter((s) => s.status === 'scheduled').length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;

  return (
    <div className="p-6 max-w-[1280px]">
      {/* ── Hero ── */}
      <SentinelPageHero
        sectionLabel="AUDIT ROOM"
        title="Plan. Execute. Close."
        subtitle="Audie manages your ISO audit lifecycle from scheduling to findings."
        sentinelColor="#F43F5E"
        stats={
          loading
            ? undefined
            : [
                { value: String(scheduledCount), label: 'Scheduled' },
                { value: String(completedCount), label: 'Completed' },
                { value: String(inProgressCount), label: 'In Progress' },
              ]
        }
      />

      {/* ── Section label + actions ── */}
      <div className="flex items-center justify-between mb-6">
        <SectionLabel>AUDITS</SectionLabel>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--content-text-dim)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audits..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <SecondaryButton onClick={() => setShowAiPlan(true)}>
            <Sparkles className="h-4 w-4" /> AI Plan
          </SecondaryButton>
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Schedule Audit
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
            heading={sessions.length === 0 ? 'No audits yet' : 'No matching audits'}
            description={
              sessions.length === 0
                ? 'Schedule your first audit or let Audie generate a plan.'
                : 'Try adjusting your search query.'
            }
            action={
              sessions.length === 0 ? (
                <PrimaryButton onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" /> Schedule Audit
                </PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--row-divider)' }}>
            {filtered.map((s, i) => (
              <div
                key={s.id}
                onClick={() => router.push(`/audit/${s.id}`)}
                className="flex items-center gap-4 px-4 py-4 cursor-pointer transition-all duration-200 hover:bg-white/[0.03] hover:pl-5 group"
              >
                <span
                  className="text-[12px] font-semibold font-heading w-8 flex-shrink-0 tabular-nums transition-colors group-hover:text-white/25"
                  style={{ color: 'var(--row-number)' }}
                >
                  /{String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{s.title}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    {AUDIT_TYPE_LABELS[s.auditType]} · {s.scope}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
                  style={{
                    color: STATUS_COLORS[s.status] ?? '#6b7280',
                    background: `${STATUS_COLORS[s.status] ?? '#6b7280'}1a`,
                  }}
                >
                  {AUDIT_STATUS_LABELS[s.status] ?? s.status}
                </span>
                <span className="text-[11px] flex-shrink-0 w-24 text-right tabular-nums" style={{ color: 'var(--content-text-dim)' }}>
                  {new Date(s.auditDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--content-text-dim)' }} />
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* ── Schedule Audit Modal ── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setAuditForm(EMPTY_AUDIT); }}
        title="Schedule Audit"
      >
        <form onSubmit={handleCreateAudit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Audit Title</label>
            <input
              type="text"
              required
              value={auditForm.title}
              onChange={(e) => setAuditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Annual ISO 9001 Internal Audit"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-white/20"
              style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select
                required
                value={auditForm.auditType}
                onChange={(e) => setAuditForm((f) => ({ ...f, auditType: e.target.value as AuditType }))}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
              >
                {AUDIT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input
                type="date"
                required
                value={auditForm.auditDate}
                onChange={(e) => setAuditForm((f) => ({ ...f, auditDate: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scope</label>
            <textarea
              required
              rows={3}
              value={auditForm.scope}
              onChange={(e) => setAuditForm((f) => ({ ...f, scope: e.target.value }))}
              placeholder="Describe what will be covered in this audit..."
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setAuditForm(EMPTY_AUDIT); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Scheduling...' : 'Schedule Audit'}</Button>
          </div>
        </form>
      </Modal>

      {/* AI Plan Modal */}
      <AiPlanModal open={showAiPlan} onOpenChange={setShowAiPlan} />
    </div>
  );
}
