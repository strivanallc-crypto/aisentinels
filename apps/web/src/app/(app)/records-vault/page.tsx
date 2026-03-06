'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Archive,
  Plus,
  AlertCircle,
  Lock,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Unlock,
} from 'lucide-react';
import { recordsApi } from '@/lib/api';
import type { VaultRecord, RecordCategory } from '@/lib/types';
import {
  RECORD_CATEGORY_LABELS,
  RECORD_CATEGORY_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';

const CATEGORIES = Object.entries(RECORD_CATEGORY_LABELS) as [RecordCategory, string][];

const CATEGORY_TABS: { value: RecordCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORIES.map(([v, l]) => ({ value: v, label: l })),
];

interface CreateRecordForm {
  title: string;
  category: RecordCategory;
  retentionYears: number;
  contentText: string;
}

const EMPTY_FORM: CreateRecordForm = {
  title: '', category: 'quality', retentionYears: 7, contentText: '',
};

export default function RecordsVaultPage() {
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateRecordForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<RecordCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [showHold, setShowHold] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recordsApi.list();
      setRecords(res.data as VaultRecord[]);
    } catch {
      setError('Failed to load records. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await recordsApi.create({
        title: form.title.trim(),
        category: form.category,
        retentionYears: form.retentionYears,
        contentText: form.contentText.trim() || undefined,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setError('Failed to create record.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      await recordsApi.verifyIntegrity(id);
      await load();
    } catch {
      setError('Integrity verification failed.');
    } finally {
      setVerifying(null);
    }
  };

  const handleLegalHold = async () => {
    if (!holdingId || !holdReason.trim()) return;
    try {
      await recordsApi.legalHold(holdingId, holdReason.trim());
      setShowHold(false);
      setHoldingId(null);
      setHoldReason('');
      await load();
    } catch {
      setError('Failed to apply legal hold.');
    }
  };

  const handleReleaseLegalHold = async (id: string) => {
    try {
      await recordsApi.releaseLegalHold(id);
      await load();
    } catch {
      setError('Failed to release legal hold.');
    }
  };

  const filtered = records.filter((r) => {
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (search) {
      return r.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const categoryCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SentinelAvatar sentinelId="doki" size={36} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              ISO Platform › Records Vault
            </p>
            <h1 className="mt-1 text-2xl font-bold">Records Vault</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
              Immutable records with integrity verification — ISO 9001 Clause 7.5.3
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Record
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Category tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => {
            const count = tab.value === 'all' ? records.length : (categoryCounts[tab.value] ?? 0);
            const active = categoryFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setCategoryFilter(tab.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                  active ? 'bg-blue-500/15 text-blue-300 font-medium' : 'hover:bg-white/5'
                }`}
                style={active ? undefined : { color: 'var(--content-text-dim)' }}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--content-text-dim)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            className="rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-white/20 w-60"
            style={{ color: 'var(--content-text)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10">
              <Archive className="h-7 w-7 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold">
                {records.length === 0 ? 'No records yet' : 'No matching records'}
              </p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                {records.length === 0 ? 'Store your first immutable record' : 'Try adjusting your filters'}
              </p>
            </div>
            {records.length === 0 && (
              <Button onClick={() => setShowCreate(true)} className="mt-1">
                <Plus className="mr-1.5 h-4 w-4" /> New Record
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Title', 'Category', 'Retention', 'Legal Hold', 'Integrity', 'Actions'].map((h) => (
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
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className="transition-colors hover:bg-white/5"
                  style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 flex-shrink-0 text-purple-400" />
                      <span className="font-medium">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={RECORD_CATEGORY_VARIANT[r.category]}>
                      {RECORD_CATEGORY_LABELS[r.category]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    {r.retentionYears} yr{r.retentionYears !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    {r.legalHold ? (
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          <Lock className="h-3 w-3" /> Hold
                        </span>
                        <button
                          onClick={() => handleReleaseLegalHold(r.id)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                          title="Release hold"
                        >
                          <Unlock className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setHoldingId(r.id); setShowHold(true); }}
                        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                      >
                        <Lock className="h-3 w-3" /> Apply
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.integrityVerifiedAt !== null ? (
                      <span className="flex w-fit items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.integrityVerifiedAt === null && (
                      <button
                        onClick={() => handleVerify(r.id)}
                        disabled={verifying === r.id}
                        className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {verifying === r.id ? 'Verifying…' : 'Verify'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Record Modal */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New Record"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Supplier Qualification Record Q-2024-001"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Category *</label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RecordCategory }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--content-text)' }}
              >
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Retention (years)</label>
              <input
                type="number"
                min={1}
                max={99}
                value={form.retentionYears}
                onChange={(e) => setForm((f) => ({ ...f, retentionYears: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--content-text)' }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Content <span className="font-normal text-gray-400">(optional — stored for integrity hashing)</span>
            </label>
            <textarea
              rows={4}
              value={form.contentText}
              onChange={(e) => setForm((f) => ({ ...f, contentText: e.target.value }))}
              placeholder="Record content…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create Record'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Legal Hold Modal */}
      <Modal
        open={showHold}
        onOpenChange={(o) => { setShowHold(o); if (!o) { setHoldingId(null); setHoldReason(''); } }}
        title="Apply Legal Hold"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
            A legal hold prevents this record from being modified or deleted until released.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Reason *</label>
            <textarea
              rows={2}
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="Reason for legal hold…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowHold(false); setHoldingId(null); setHoldReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleLegalHold} disabled={!holdReason.trim()}>
              <Lock className="mr-1.5 h-4 w-4" />
              Apply Hold
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
