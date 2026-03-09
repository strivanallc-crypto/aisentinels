'use client';

import { useEffect, useState } from 'react';
import { riskApi } from '@/lib/api';

interface Risk {
  id: string;
  title: string;
  category: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  status: string;
}

const riskLevel = (score: number) => {
  if (score >= 15) return { label: 'CRITICAL', cls: 'bg-red-100 text-red-700' };
  if (score >= 10) return { label: 'HIGH',     cls: 'bg-orange-100 text-orange-700' };
  if (score >= 5)  return { label: 'MEDIUM',   cls: 'bg-yellow-100 text-yellow-700' };
  return                  { label: 'LOW',      cls: 'bg-green-100 text-green-700' };
};

export default function RiskPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    riskApi.list().then((r) => { setRisks(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await riskApi.create(form);
    setSaving(false);
    setShowForm(false);
    setForm({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' });
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Risk Navigator</h2>
          <p className="text-gray-500 text-sm">Risk register and heat-map management</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Add Risk
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">New Risk</h3>
            <input required placeholder="Risk Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {['QUALITY', 'SAFETY', 'OPERATIONAL', 'REGULATORY', 'FINANCIAL', 'REPUTATIONAL', 'ENVIRONMENTAL'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Likelihood (1-5): {form.likelihood}</label>
                <input type="range" min={1} max={5} value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Impact (1-5): {form.impact}</label>
                <input type="range" min={1} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
            <p className="text-xs text-gray-500">Risk Score: <strong>{form.likelihood * form.impact}</strong> / 25</p>
            <textarea placeholder="Mitigation Plan" value={form.mitigationPlan} onChange={(e) => setForm({ ...form, mitigationPlan: e.target.value })} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Risk'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : risks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No risks registered yet.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Risk Title', 'Category', 'Likelihood', 'Impact', 'Score', 'Level'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {risks.map((r) => {
                const level = riskLevel(r.riskScore);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                    <td className="px-4 py-3 text-gray-500">{r.category}</td>
                    <td className="px-4 py-3 text-center">{r.likelihood}</td>
                    <td className="px-4 py-3 text-center">{r.impact}</td>
                    <td className="px-4 py-3 text-center font-semibold">{r.riskScore}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${level.cls}`}>{level.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
