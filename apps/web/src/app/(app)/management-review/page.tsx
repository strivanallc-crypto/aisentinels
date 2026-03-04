'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  AlertCircle,
  Search,
  CheckCircle2,
  Clock,
  CalendarDays,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { reviewApi, aiApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';

interface Review {
  id: string;
  title: string;
  status: string;
  scheduledDate: string;
  conclusions?: string;
  decisions?: string[];
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' }> = {
  completed: { label: 'Completed', variant: 'success' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  scheduled: { label: 'Scheduled', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SCHEDULED: { label: 'Scheduled', variant: 'default' },
};

export default function ManagementReviewPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', scheduledDate: '', agenda: '', attendees: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // AI Review
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await reviewApi.list();
      setReviews(r.data as Review[]);
    } catch {
      setError('Failed to load reviews.');
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
    } catch {
      setError('Failed to schedule review.');
    } finally {
      setSaving(false);
    }
  };

  const handleAiReview = async () => {
    setAiLoading(true);
    try {
      const res = await aiApi.managementReview({
        auditResults: {},
        capaStatus: {},
        complianceScores: {},
      });
      const data = res.data as { report?: string };
      setAiResult(data.report ?? JSON.stringify(data, null, 2));
      setShowAiResult(true);
    } catch {
      setError('AI review generation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const filtered = reviews.filter((r) => {
    const status = r.status.toLowerCase();
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q);
    }
    return true;
  });

  const statusCounts = reviews.reduce<Record<string, number>>((acc, r) => {
    const s = r.status.toLowerCase();
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Management Review
          </p>
          <h1 className="mt-1 text-2xl font-bold">Management Review</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            ISO Clause 9.3 — Leadership management review meetings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAiReview} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            AI Review Input
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Schedule Review
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? reviews.length : (statusCounts[tab.value] ?? 0);
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews…"
            className="rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 w-60"
          />
        </div>
      </div>

      {/* List */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="h-10 w-10" style={{ color: 'var(--content-text-dim)' }} />
            <div>
              <p className="font-semibold">{reviews.length === 0 ? 'No reviews scheduled' : 'No matching reviews'}</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                {reviews.length === 0 ? 'Schedule your first management review' : 'Try adjusting your filters'}
              </p>
            </div>
            {reviews.length === 0 && (
              <Button onClick={() => setShowForm(true)} className="mt-2">
                <Plus className="mr-1.5 h-4 w-4" /> Schedule Review
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--content-border)' }}>
            {filtered.map((rev) => {
              const cfg = STATUS_CONFIG[rev.status] ?? { label: rev.status, variant: 'secondary' as const };
              return (
                <div key={rev.id} className="flex items-start justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {rev.status.toLowerCase() === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : rev.status.toLowerCase() === 'in_progress' ? (
                        <Clock className="h-5 w-5 text-amber-500" />
                      ) : (
                        <CalendarDays className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{rev.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-muted)' }}>
                        {rev.scheduledDate ? new Date(rev.scheduledDate).toLocaleDateString() : '—'}
                      </p>
                      {rev.conclusions && (
                        <p className="text-xs mt-2 max-w-xl" style={{ color: 'var(--content-text-muted)' }}>
                          {rev.conclusions}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Review Modal */}
      <Modal
        open={showForm}
        onOpenChange={(o) => { setShowForm(o); if (!o) setForm({ title: '', scheduledDate: '', agenda: '', attendees: '' }); }}
        title="Schedule Management Review"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Q1 2026 Management Review"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
            <input
              type="date"
              required
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Agenda</label>
            <textarea
              rows={3}
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              placeholder="Agenda items for the review…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Attendees</label>
            <input
              value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })}
              placeholder="Comma-separated names or IDs"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Scheduling…' : 'Schedule Review'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI Review Result Modal */}
      <Modal
        open={showAiResult}
        onOpenChange={setShowAiResult}
        title="AI Management Review Input"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--content-text)' }}>
            {aiResult}
          </pre>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="ghost" onClick={() => setShowAiResult(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
