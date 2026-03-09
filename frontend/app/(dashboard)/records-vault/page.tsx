'use client';

import { useEffect, useState } from 'react';
import { recordsApi } from '@/lib/api';
import { Plus, Archive, X, ShieldCheck, Lock, CheckCircle2, Clock } from 'lucide-react';

interface Rec {
  id: string; title: string; category: string;
  retentionPeriod: number; legalHold: boolean;
  integrityVerified: boolean; createdAt: string;
}

const CAT_STYLE: Record<string, { bg: string; color: string }> = {
  QUALITY:        { bg: '#eff6ff', color: '#2563eb' },
  SAFETY:         { bg: '#fef2f2', color: '#dc2626' },
  TRAINING:       { bg: '#f0fdf4', color: '#16a34a' },
  CALIBRATION:    { bg: '#fefce8', color: '#ca8a04' },
  AUDIT:          { bg: '#f5f3ff', color: '#7c3aed' },
  INCIDENT:       { bg: '#fff7ed', color: '#ea580c' },
  ENVIRONMENTAL:  { bg: '#ecfdf5', color: '#059669' },
};

const FIELD = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function RecordsVaultPage() {
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'QUALITY', retentionPeriod: 7, content: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    recordsApi.list().then(r => { setRecords(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await recordsApi.create(form);
    setSaving(false); setOpen(false);
    setForm({ title: '', category: 'QUALITY', retentionPeriod: 7, content: '' }); load();
  };

  const handleVerify = async (id: string) => {
    await recordsApi.verifyIntegrity(id); load();
  };

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Records Vault</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Immutable records with integrity verification</p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ background: '#2563eb' }}>
          <Plus className="h-4 w-4" /> New Record
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: '#f3f4f6' }} />)}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#f5f3ff' }}>
              <Archive className="h-7 w-7" style={{ color: '#7c3aed' }} />
            </div>
            <p className="font-medium" style={{ color: '#374151' }}>No records yet</p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>Store your first immutable record</p>
            <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: '#2563eb' }}>
              <Plus className="h-4 w-4" /> New Record
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
              <tr>
                {['Title', 'Category', 'Retention', 'Legal Hold', 'Integrity', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const cs = CAT_STYLE[r.category] ?? { bg: '#f3f4f6', color: '#6b7280' };
                return (
                  <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid #f9fafb' : 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#111827' }}>
                      <div className="flex items-center gap-2">
                        <Archive className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9ca3af' }} />
                        {r.title}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: cs.bg, color: cs.color }}>{r.category}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: '#6b7280' }}>{r.retentionPeriod} yr{r.retentionPeriod !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-3.5">
                      {r.legalHold
                        ? <span className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: '#fef2f2', color: '#dc2626' }}><Lock className="h-3 w-3" />Legal Hold</span>
                        : <span className="text-xs" style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.integrityVerified
                        ? <span className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: '#f0fdf4', color: '#16a34a' }}><CheckCircle2 className="h-3 w-3" />Verified</span>
                        : <span className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: '#fefce8', color: '#a16207' }}><Clock className="h-3 w-3" />Pending</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {!r.integrityVerified && (
                        <button onClick={() => handleVerify(r.id)}
                          className="flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 transition-colors"
                          style={{ color: '#2563eb', background: '#eff6ff' }}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
          <form onSubmit={handleCreate} className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <h2 className="font-semibold" style={{ color: '#111827' }}>New Record</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1" style={{ color: '#9ca3af' }}><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Title</label>
                <input required placeholder="Record title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }}>
                    {Object.keys(CAT_STYLE).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Retention (years)</label>
                  <input type="number" min={1} value={form.retentionPeriod}
                    onChange={e => setForm({ ...form, retentionPeriod: Number(e.target.value) })}
                    className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Content</label>
                <textarea placeholder="Record content…" value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })} rows={4}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827', resize: 'none' }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb' }}>Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#2563eb' }}>{saving ? 'Saving…' : 'Create Record'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
