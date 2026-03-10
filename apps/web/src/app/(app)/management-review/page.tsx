'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { reviewApi, aiApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  SentinelPageHero,
  PrimaryButton,
  SecondaryButton,
  SadewaEmptyState,
  SectionLabel,
  ContentCard,
  PageSkeleton,
} from '@/components/ui/sentinel-page-hero';

interface Review {
  id: string;
  title: string;
  status: string;
  scheduledDate: string;
  conclusions?: string;
  decisions?: string[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  in_progress: '#F59E0B',
  scheduled: '#3B82F6',
};

export default function ManagementReviewPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', scheduledDate: '', agenda: '', attendees: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await reviewApi.list();
      setReviews(Array.isArray(r.data) ? r.data as Review[] : []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduledDate) return;
    setSaving(true);
    try {
      await reviewApi.create({
        ...form,
        attendees: form.attendees.split(',').map((a) => a.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm({ title: '', scheduledDate: '', agenda: '', attendees: '' });
      await load();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleAiReview = async () => {
    setAiLoading(true);
    try {
      const res = await aiApi.managementReview({ auditResults: {}, capaStatus: {}, complianceScores: {} });
      const data = res.data as { report?: string };
      setAiResult(data.report ?? JSON.stringify(data, null, 2));
      setShowAiResult(true);
    } catch { /* silent */ } finally { setAiLoading(false); }
  };

  const filtered = reviews.filter((r) => {
    if (!search) return true;
    return r.title.toLowerCase().includes(search.toLowerCase());
  });

  const scheduledCount = reviews.filter((r) => r.status.toLowerCase() === 'scheduled').length;
  const completedCount = reviews.filter((r) => r.status.toLowerCase() === 'completed').length;
  const totalCount = reviews.length;

  return (
    <div className="p-6 max-w-[1280px]">
      <SentinelPageHero
        sectionLabel="MANAGEMENT REVIEW"
        title="Clause 9.3. Made Simple."
        subtitle="Qualy orchestrates leadership reviews with AI-generated inputs and decision tracking."
        sentinelColor="#3B82F6"
        stats={
          loading
            ? undefined
            : [
                { value: String(totalCount), label: 'Reviews' },
                { value: String(scheduledCount), label: 'Scheduled' },
                { value: String(completedCount), label: 'Completed' },
              ]
        }
      />

      <div className="flex items-center justify-between mb-6">
        <SectionLabel>REVIEWS</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#4b5563' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews..."
              className="rounded-full border bg-transparent py-2 pl-9 pr-4 text-sm outline-none w-56 focus:border-white/20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>
          <SecondaryButton onClick={handleAiReview} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI Review Input
          </SecondaryButton>
          <PrimaryButton onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Schedule Review
          </PrimaryButton>
        </div>
      </div>

      <ContentCard>
        {loading ? (
          <PageSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading={reviews.length === 0 ? 'No reviews scheduled' : 'No matching reviews'}
            description={reviews.length === 0 ? 'Schedule your first management review meeting.' : 'Try adjusting your search query.'}
            action={reviews.length === 0 ? (<PrimaryButton onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Schedule Review</PrimaryButton>) : undefined}
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {filtered.map((rev, i) => {
              const statusKey = rev.status.toLowerCase();
              const color = STATUS_COLORS[statusKey] ?? '#6b7280';
              const label = statusKey === 'completed' ? 'Completed' : statusKey === 'in_progress' ? 'In Progress' : 'Scheduled';
              return (
                <div key={rev.id} className="flex items-center gap-4 px-4 py-4 transition-all duration-200 hover:bg-white/[0.03] hover:pl-5 group">
                  <span className="text-[12px] font-semibold font-heading w-8 flex-shrink-0 tabular-nums transition-colors group-hover:text-white/25" style={{ color: 'rgba(255,255,255,0.12)' }}>/{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{rev.title}</p>
                    <p className="text-[11px]" style={{ color: '#6b7280' }}>
                      {rev.scheduledDate ? new Date(rev.scheduledDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '\u2014'}
                    </p>
                    {rev.conclusions && (
                      <p className="text-[11px] mt-1 truncate max-w-xl" style={{ color: '#4b5563' }}>{rev.conclusions}</p>
                    )}
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0" style={{ color, background: `${color}1a` }}>{label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: '#4b5563' }} />
                </div>
              );
            })}
          </div>
        )}
      </ContentCard>

      {/* Schedule Review Modal */}
      <Modal open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setForm({ title: '', scheduledDate: '', agenda: '', attendees: '' }); }} title="Schedule Management Review">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q1 2026 Management Review" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Date</label>
            <input type="date" required value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Agenda</label>
            <textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} placeholder="Agenda items..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#9ca3af' }}>Attendees</label>
            <input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="Comma-separated names" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" style={{ color: '#fff' }} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Scheduling...' : 'Schedule Review'}</Button>
          </div>
        </form>
      </Modal>

      {/* AI Review Result Modal */}
      <Modal open={showAiResult} onOpenChange={setShowAiResult} title="AI Management Review Input">
        <div className="max-h-[60vh] overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#fff' }}>{aiResult}</pre>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="ghost" onClick={() => setShowAiResult(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
