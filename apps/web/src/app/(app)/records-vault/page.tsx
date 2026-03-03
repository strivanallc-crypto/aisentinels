'use client';

import { useState, useEffect, useCallback } from 'react';
import { Archive, Plus, AlertCircle, Lock, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
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

const CATEGORIES = Object.entries(RECORD_CATEGORY_LABELS) as [RecordCategory, string][];

interface CreateRecordForm {
  title: string;
  category: RecordCategory;
  retentionYears: number;
  contentText: string;
}

const EMPTY_FORM: CreateRecordForm = {
  title:          '',
  category:       'quality',
  retentionYears: 7,
  contentText:    '',
};

export default function RecordsVaultPage() {
  const [records, setRecords]       = useState<VaultRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState<CreateRecordForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [verifying, setVerifying]   = useState<string | null>(null);

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
        title:          form.title.trim(),
        category:       form.category,
        retentionYears: form.retentionYears,
        contentText:    form.contentText.trim() || undefined,
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

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Records Vault
          </p>
          <h1 className="mt-1 text-2xl font-bold">Records Vault</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Immutable records with integrity verification — ISO 9001 Clause 7.5.3
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Record
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
          <TableSkeleton rows={5} cols={6} />
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
              <Archive className="h-7 w-7 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold">No records yet</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                Store your first immutable record
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="mt-1">
              <Plus className="mr-1.5 h-4 w-4" /> New Record
            </Button>
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
              {records.map((r, i) => (
                <tr
                  key={r.id}
                  className="transition-colors hover:bg-gray-50"
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
                      {RECORD_CATEGORY_LABELS[r.category] ?? r.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    {r.retentionYears} yr{r.retentionYears !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    {r.legalHold ? (
                      <span className="flex w-fit items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        <Lock className="h-3 w-3" /> Legal Hold
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>—</span>
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

      {/* ── Create Record Modal ───────────────────────────────────── */}
      <Modal
        open={showCreate}
        onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }}
        title="New Record"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Supplier Qualification Record Q-2024-001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Category + Retention */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RecordCategory }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Retention (years)
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={form.retentionYears}
                onChange={(e) => setForm((f) => ({ ...f, retentionYears: Number(e.target.value) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Content{' '}
              <span className="font-normal text-gray-400">(optional — stored for integrity hashing)</span>
            </label>
            <textarea
              rows={4}
              value={form.contentText}
              onChange={(e) => setForm((f) => ({ ...f, contentText: e.target.value }))}
              placeholder="Record content…"
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
              {saving ? 'Creating…' : 'Create Record'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
