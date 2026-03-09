'use client';

import { useEffect, useState } from 'react';
import { capaApi } from '@/lib/api';
import { Plus, Wrench, X } from 'lucide-react';

interface Capa {
  id: string; title: string; type: string;
  status: string; severity: string; dueDate: string;
}

const SEV: Record<string, { bg: string; color: string; dot: string }> = {
  CRITICAL: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  HIGH:     { bg: '#fff7ed', color: '#ea580c', dot: '#f97316' },
  MEDIUM:   { bg: '#fefce8', color: '#ca8a04', dot: '#eab308' },
  LOW:      { bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
};

const STATUS: Record<string, { bg: string; color: string; dot: string }> = {
  OPEN:        { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
  IN_PROGRESS: { bg: '#fefce8', color: '#a16207', dot: '#eab308' },
  CLOSED:      { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  CANCELLED:   { bg: '#f9fafb', color: '#6b7280', dot: '#9ca3af' },
};

const FIELD = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function CapaPage() {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'CORRECTIVE', severity: 'MEDIUM', rootCause: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    capaApi.list().then(r => { setCapas(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await capaApi.create(form);
    setSaving(false); setOpen(false);
    setForm({ title: '', description: '', type: 'CORRECTIVE', severity: 'MEDIUM', rootCause: '', dueDate: '' }); load();
  };

  const isOverdue = (date: string) => date && new Date(date) < new Date();

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>CAPA Hub</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Corrective and preventive action management</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: '#2563eb' }}>
          <Plus className="h-4 w-4" /> New CAPA
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: '#f3f4f6' }} />)}</div>
        ) : capas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#fffbeb' }}>
              <Wrench className="h-7 w-7" style={{ color: '#d97706' }} />
            </div>
            <p className="font-medium" style={{ color: '#374151' }}>No CAPAs yet</p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>Track corrective and preventive actions</p>
            <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: '#2563eb' }}>
              <Plus className="h-4 w-4" /> New CAPA
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
              <tr>
                {['Title', 'Type', 'Severity', 'Status', 'Due Date'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capas.map((c, i) => {
                const sev = SEV[c.severity] ?? SEV.MEDIUM;
                const st  = STATUS[c.status] ?? STATUS.OPEN;
                const overdue = isOverdue(c.dueDate) && c.status !== 'CLOSED';
                return (
                  <tr key={c.id} style={{ borderBottom: i < capas.length - 1 ? '1px solid #f9fafb' : 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#111827' }}>
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9ca3af' }} />
                        {c.title}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium rounded-md px-2 py-0.5"
                        style={{ background: c.type === 'CORRECTIVE' ? '#eff6ff' : '#f5f3ff', color: c.type === 'CORRECTIVE' ? '#2563eb' : '#7c3aed' }}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sev.bg, color: sev.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.dot }} />{c.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: st.bg, color: st.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{c.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: overdue ? '#dc2626' : '#9ca3af', fontWeight: overdue ? 600 : 400 }}>
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      {overdue && <span className="ml-1.5 text-[10px] rounded px-1 py-0.5" style={{ background: '#fef2f2', color: '#dc2626' }}>Overdue</span>}
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
              <h2 className="font-semibold" style={{ color: '#111827' }}>New CAPA</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1" style={{ color: '#9ca3af' }}><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Title</label>
                <input required placeholder="CAPA title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                <textarea placeholder="Describe the issue or opportunity…" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827', resize: 'none' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }}>
                    <option value="CORRECTIVE">Corrective</option>
                    <option value="PREVENTIVE">Preventive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Severity</label>
                  <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
                    className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }}>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Root Cause</label>
                <input placeholder="Root cause analysis" value={form.rootCause}
                  onChange={e => setForm({ ...form, rootCause: e.target.value })}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb' }}>Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#2563eb' }}>{saving ? 'Creating…' : 'Create CAPA'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
