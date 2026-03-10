'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import { riskApi } from '@/lib/api';
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

const riskLevel = (score: number): { label: string; color: string } => {
  if (score >= 15) return { label: 'Critical', color: '#EF4444' };
  if (score >= 10) return { label: 'High', color: '#F59E0B' };
  if (score >= 5)  return { label: 'Medium', color: '#3B82F6' };
  return                   { label: 'Low', color: '#22C55E' };
};

export default function RiskPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await riskApi.list();
      setRisks(Array.isArray(r.data) ? r.data as Risk[] : []);
    } catch {
      setRisks([]);
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
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const filtered = risks.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  });

  const totalCount = risks.length;
  const criticalCount = risks.filter((r) => r.riskScore >= 15).length;
  const highCount = risks.filter((r) => r.riskScore >= 10 && r.riskScore < 15).length;

  return (
    <div className="p-6 max-w-[1280px]">
      <SentinelPageHero
        sectionLabel="RISK NAVIGATOR"
        title="Identify. Assess. Mitigate."
        subtitle="Saffy maps risks across your integrated management system with intelligent scoring."
        sentinelColor="#F59E0B"
        stats={
          loading
            ? undefined
            : [
                { value: String(totalCount), label: 'Risks' },
                { value: String(criticalCount), label: 'Critical' },
                { value: String(highCount), label: 'High' },
              ]
        }
      />

      <div className="flex items-center justify-between mb-6">
        <SectionLabel>RISK REGISTER</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#4b5563' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search risks..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>
          <PrimaryButton onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Add Risk
          </PrimaryButton>
        </div>
      </div>

      <ContentCard>
        {loading ? (
          <PageSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={risks.length === 0 ? 'No risks registered' : 'No matching risks'}
            description={risks.length === 0 ? 'Add your first risk to the register.' : 'Try adjusting your search query.'}
            action={risks.length === 0 ? (<PrimaryButton onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Risk</PrimaryButton>) : undefined}
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {filtered.map((r, i) => {
              const level = riskLevel(r.riskScore);
              return (
                <div key={r.id} className="flex items-center gap-4 px-4 py-4 transition-all duration-200 hover:bg-white/[0.03] hover:pl-5 group">
                  <span className="text-[12px] font-semibold font-heading w-8 flex-shrink-0 tabular-nums transition-colors group-hover:text-white/25" style={{ color: 'rgba(255,255,255,0.12)' }}>/{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{r.title}</p>
                    <p className="text-[11px]" style={{ color: '#6b7280' }}>{r.category.charAt(0) + r.category.slice(1).toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-center"><p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4b5563' }}>L</p><p className="text-[13px] font-semibold tabular-nums">{r.likelihood}</p></div>
                    <div className="text-center"><p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4b5563' }}>I</p><p className="text-[13px] font-semibold tabular-nums">{r.impact}</p></div>
                    <div className="text-center"><p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4b5563' }}>Score</p><p className="text-[13px] font-bold tabular-nums" style={{ color: level.color }}>{r.riskScore}</p></div>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0" style={{ color: level.color, background: `${level.color}1a` }}>{level.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: '#4b5563' }} />
                </div>
              );
            })}
          </div>
        )}
      </ContentCard>

      <Modal open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setForm({ title: '', description: '', category: 'QUALITY', likelihood: 3, impact: 3, mitigationPlan: '' }); }} title="New Risk">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Risk Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Supplier quality variance" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the risk..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Likelihood: {form.likelihood}</label>
              <input type="range" min={1} max={5} value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Impact: {form.impact}</label>
              <input type="range" min={1} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: '#9ca3af' }}>Risk Score:</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: riskLevel(form.likelihood * form.impact).color, background: `${riskLevel(form.likelihood * form.impact).color}1a` }}>
              {form.likelihood * form.impact} / 25 {'\u2014'} {riskLevel(form.likelihood * form.impact).label}
            </span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Mitigation Plan</label>
            <textarea rows={2} value={form.mitigationPlan} onChange={(e) => setForm({ ...form, mitigationPlan: e.target.value })} placeholder="Describe mitigation strategy..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add Risk'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
