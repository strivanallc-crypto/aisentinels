'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Lock,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Unlock,
  ArrowUpRight,
} from 'lucide-react';
import { recordsApi } from '@/lib/api';
import type { VaultRecord, RecordCategory } from '@/lib/types';
import { RECORD_CATEGORY_LABELS } from '@/lib/types';
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

const CATEGORIES = Object.entries(RECORD_CATEGORY_LABELS) as [RecordCategory, string][];

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
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateRecordForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [showHold, setShowHold] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recordsApi.list();
      setRecords(Array.isArray(res.data) ? res.data as VaultRecord[] : []);
    } catch {
      setRecords([]);
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
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try { await recordsApi.verifyIntegrity(id); await load(); } catch { /* silent */ } finally { setVerifying(null); }
  };

  const handleLegalHold = async () => {
    if (!holdingId || !holdReason.trim()) return;
    try {
      await recordsApi.legalHold(holdingId, holdReason.trim());
      setShowHold(false); setHoldingId(null); setHoldReason('');
      await load();
    } catch { /* silent */ }
  };

  const handleReleaseLegalHold = async (id: string) => {
    try { await recordsApi.releaseLegalHold(id); await load(); } catch { /* silent */ }
  };

  const filtered = records.filter((r) => {
    if (!search) return true;
    return r.title.toLowerCase().includes(search.toLowerCase());
  });

  const totalCount = records.length;
  const verifiedCount = records.filter((r) => r.integrityVerifiedAt !== null).length;
  const holdCount = records.filter((r) => r.legalHold).length;

  return (
    <div className="p-6 max-w-[1280px]">
      <SentinelPageHero
        sectionLabel="RECORDS VAULT"
        title="Every Record. Always Safe."
        subtitle="Doki stores immutable records with integrity verification and legal hold capabilities."
        sentinelColor="#6366F1"
        stats={
          loading
            ? undefined
            : [
                { value: String(totalCount), label: 'Records' },
                { value: String(verifiedCount), label: 'Verified' },
                { value: String(holdCount), label: 'Legal Hold' },
              ]
        }
      />

      <div className="flex items-center justify-between mb-6">
        <SectionLabel>ALL RECORDS</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#4b5563' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New Record
          </PrimaryButton>
        </div>
      </div>

      <ContentCard>
        {loading ? (
          <PageSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={records.length === 0 ? 'No records yet' : 'No matching records'}
            description={records.length === 0 ? 'Store your first immutable record in the vault.' : 'Try adjusting your search query.'}
            action={records.length === 0 ? (<PrimaryButton onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Record</PrimaryButton>) : undefined}
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {filtered.map((r, i) => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-4 transition-all duration-200 hover:bg-white/[0.03] hover:pl-5 group">
                <span className="text-[12px] font-semibold font-heading w-8 flex-shrink-0 tabular-nums transition-colors group-hover:text-white/25" style={{ color: 'rgba(255,255,255,0.12)' }}>/{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{r.title}</p>
                  <p className="text-[11px]" style={{ color: '#6b7280' }}>
                    {RECORD_CATEGORY_LABELS[r.category]} · {r.retentionYears} yr retention
                  </p>
                </div>

                {/* Legal Hold */}
                {r.legalHold ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex items-center gap-1" style={{ color: '#EF4444', background: '#EF44441a' }}>
                      <Lock className="h-3 w-3" /> Hold
                    </span>
                    <button onClick={() => handleReleaseLegalHold(r.id)} className="rounded p-0.5 hover:bg-white/10" title="Release hold" style={{ color: '#6b7280' }}>
                      <Unlock className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setHoldingId(r.id); setShowHold(true); }} className="flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 hover:bg-white/5" style={{ color: '#6b7280' }}>
                    <Lock className="h-3 w-3" /> Hold
                  </button>
                )}

                {/* Integrity */}
                {r.integrityVerifiedAt !== null ? (
                  <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0" style={{ color: '#22C55E', background: '#22C55E1a' }}>
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                ) : (
                  <button
                    onClick={() => handleVerify(r.id)}
                    disabled={verifying === r.id}
                    className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-white/5 disabled:opacity-50 flex-shrink-0"
                    style={{ color: '#F59E0B', background: '#F59E0B1a' }}
                  >
                    {verifying === r.id ? <Clock className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    {verifying === r.id ? 'Checking...' : 'Verify'}
                  </button>
                )}

                <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: '#4b5563' }} />
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Create Record Modal */}
      <Modal open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setForm(EMPTY_FORM); }} title="New Record">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Title</label>
            <input type="text" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Supplier Qualification Record Q-2024-001" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Category</label>
              <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RecordCategory }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }}>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Retention (years)</label>
              <input type="number" min={1} max={99} value={form.retentionYears} onChange={(e) => setForm((f) => ({ ...f, retentionYears: Number(e.target.value) }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Content <span style={{ color: '#4b5563' }}>(optional)</span></label>
            <textarea rows={4} value={form.contentText} onChange={(e) => setForm((f) => ({ ...f, contentText: e.target.value }))} placeholder="Record content..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Record'}</Button>
          </div>
        </form>
      </Modal>

      {/* Legal Hold Modal */}
      <Modal open={showHold} onOpenChange={(o) => { setShowHold(o); if (!o) { setHoldingId(null); setHoldReason(''); } }} title="Apply Legal Hold">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: '#9ca3af' }}>A legal hold prevents this record from being modified or deleted until released.</p>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Reason</label>
            <textarea rows={2} value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Reason for legal hold..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowHold(false); setHoldingId(null); setHoldReason(''); }}>Cancel</Button>
            <Button onClick={handleLegalHold} disabled={!holdReason.trim()}><Lock className="mr-1.5 h-4 w-4" /> Apply Hold</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
