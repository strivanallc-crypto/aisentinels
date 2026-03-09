'use client';

import { useEffect, useState } from 'react';
import { auditApi } from '@/lib/api';

interface Audit {
  id: string;
  title: string;
  type: string;
  status: string;
  standard: string;
  scheduledDate: string;
  findings?: { id: string; description: string; severity: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED:    'bg-blue-100 text-blue-700',
  IN_PROGRESS:'bg-yellow-100 text-yellow-700',
  COMPLETED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-gray-100 text-gray-500',
};

export default function AuditPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'INTERNAL', standard: 'ISO 9001:2015', scope: '', scheduledDate: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    auditApi.list().then((r) => { setAudits(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await auditApi.create(form);
    setSaving(false);
    setShowForm(false);
    setForm({ title: '', type: 'INTERNAL', standard: 'ISO 9001:2015', scope: '', scheduledDate: '' });
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Command</h2>
          <p className="text-gray-500 text-sm">Plan and track internal and external audits</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Schedule Audit
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Schedule Audit</h3>
            <input required placeholder="Audit Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'REGULATORY'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Standard (e.g. ISO 9001)" value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <input placeholder="Scope" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : audits.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No audits scheduled yet.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Title', 'Type', 'Standard', 'Status', 'Scheduled'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {audits.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.title}</td>
                  <td className="px-4 py-3 text-gray-500">{a.type}</td>
                  <td className="px-4 py-3 text-gray-500">{a.standard}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {a.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
