'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Search,
} from 'lucide-react';
import { auditApi } from '@/lib/api';
import type { AuditSession, AuditType, AuditSessionStatus } from '@/lib/types';
import {
  AUDIT_TYPE_LABELS,
  AUDIT_STATUS_LABELS,
  AUDIT_STATUS_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Audie } from '@/components/sentinels/audie';
import { AiPlanModal } from '@/components/audit/ai-plan-modal';

const AUDIT_TYPES = Object.entries(AUDIT_TYPE_LABELS) as [AuditType, string][];

const STATUS_TABS: { value: AuditSessionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

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
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [auditForm, setAuditForm] = useState<CreateAuditForm>(EMPTY_AUDIT);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AuditSessionStatus | 'all'>('all');
  const [search, setSearch] = useState('');

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
    } catch {
      setError('Failed to schedule audit.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = sessions.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.scope.toLowerCase().includes(q);
    }
    return true;
  });

  const statusCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Audie size={36} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              ISO Platform › Audit Room
            </p>
            <h1 className="mt-0.5 text-2xl font-bold">Audit Room</h1>
            <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
              ISO 19011 audit lifecycle — plan, examine, report
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAiPlan(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            AI Plan
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Schedule Audit
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? sessions.length : (statusCounts[tab.value] ?? 0);
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-rose-50 text-rose-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? 'bg-rose-200 text-rose-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audits…"
            className="rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 w-60"
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <Audie size={32} />
            </div>
            <div>
              <p className="font-semibold">
                {sessions.length === 0 ? 'No audits yet' : 'No matching audits'}
              </p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                {sessions.length === 0
                  ? 'Schedule your first audit or let Audie generate a plan'
                  : 'Try adjusting your filters'}
              </p>
            </div>
            {sessions.length === 0 && (
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={() => setShowAiPlan(true)}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> AI Plan
                </Button>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Schedule Audit
                </Button>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Title', 'Type', 'Scope', 'Status', 'Date', ''].map((h) => (
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
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/audit/${s.id}`)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                >
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--content-text-muted)' }}>
                    {AUDIT_TYPE_LABELS[s.auditType]}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    {s.scope}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={AUDIT_STATUS_VARIANT[s.status]}>
                      {AUDIT_STATUS_LABELS[s.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                        {new Date(s.auditDate).toLocaleDateString()}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schedule Audit Modal */}
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Type *</label>
              <select
                required
                value={auditForm.auditType}
                onChange={(e) => setAuditForm((f) => ({ ...f, auditType: e.target.value as AuditType }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
              >
                {AUDIT_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
              <input
                type="date"
                required
                value={auditForm.auditDate}
                onChange={(e) => setAuditForm((f) => ({ ...f, auditDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Scope *</label>
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
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setAuditForm(EMPTY_AUDIT); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Scheduling…' : 'Schedule Audit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI Plan Modal */}
      <AiPlanModal open={showAiPlan} onOpenChange={setShowAiPlan} />
    </div>
  );
}
