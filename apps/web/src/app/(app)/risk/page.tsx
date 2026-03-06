'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  AlertCircle,
  Search,
} from 'lucide-react';
import { riskApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { SentinelAvatar } from '@/components/SentinelAvatar';

interface Risk {
  id: string;
  title: string;
  category: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  status: string;
}

const CATEGORIES = ['QUALITY', 'SAFETY', 'OPERATIONAL', 'REGULATORY', 'FINANCIAL', 'REPUTATIONAL', 'ENVIRONMENTAL'];

const riskLevel = (score: number): { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' } => {
  if (score >= 15) return { label: 'Critical', variant: 'destructive' };
  if (score >= 10) return { label: 'High', variant: 'destructive' };
  if (score >= 5)  return { label: 'Medium', variant: 'warning' };
  return                  { label: 'Low', variant: 'success' };
};

export default function RiskPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await riskApi.list();
      setRisks(r.data as Risk[]);
    } catch {
      setError('Failed to load risks.');
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
      await riskApi.create(form);
      setShowForm(false);
      setForm({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' });
      await load();
    } catch {
      setError('Failed to add risk.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = risks.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SentinelAvatar sentinelId="saffy" size={36} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              ISO Platform › Risk Navigator
            </p>
            <h1 className="mt-1 text-2xl font-bold">Risk Navigator</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
              Risk register and heat-map management
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Risk
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

      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
          {risks.length} risk{risks.length !== 1 ? 's' : ''} in register
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--content-text-dim)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search risks…"
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
            <AlertTriangle className="h-10 w-10" style={{ color: 'var(--content-text-dim)' }} />
            <div>
              <p className="font-semibold">{risks.length === 0 ? 'No risks registered' : 'No matching risks'}</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                {risks.length === 0 ? 'Add your first risk to the register' : 'Try adjusting your search'}
              </p>
            </div>
            {risks.length === 0 && (
              <Button onClick={() => setShowForm(true)} className="mt-2">
                <Plus className="mr-1.5 h-4 w-4" /> Add Risk
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}>
                {['Risk Title', 'Category', 'Likelihood', 'Impact', 'Score', 'Level'].map((h) => (
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
              {filtered.map((r, i) => {
                const level = riskLevel(r.riskScore);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-white/5 transition-colors"
                    style={{ borderTop: i > 0 ? '1px solid var(--content-border)' : undefined }}
                  >
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--content-text-muted)' }}>{r.category}</td>
                    <td className="px-4 py-3 text-center">{r.likelihood}</td>
                    <td className="px-4 py-3 text-center">{r.impact}</td>
                    <td className="px-4 py-3 text-center font-semibold">{r.riskScore}</td>
                    <td className="px-4 py-3">
                      <Badge variant={level.variant}>{level.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Risk Modal */}
      <Modal
        open={showForm}
        onOpenChange={(o) => { setShowForm(o); if (!o) setForm({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' }); }}
        title="New Risk"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Risk Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Supplier quality variance"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the risk…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--content-text)' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                Likelihood: {form.likelihood}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={form.likelihood}
                onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                Impact: {form.impact}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={form.impact}
                onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--content-text-muted)' }}>Risk Score:</span>
            <Badge variant={riskLevel(form.likelihood * form.impact).variant}>
              {form.likelihood * form.impact} / 25 — {riskLevel(form.likelihood * form.impact).label}
            </Badge>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Mitigation Plan</label>
            <textarea
              rows={2}
              value={form.mitigationPlan}
              onChange={(e) => setForm({ ...form, mitigationPlan: e.target.value })}
              placeholder="Describe mitigation strategy…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add Risk'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
