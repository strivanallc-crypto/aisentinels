'use client';

import { useEffect, useState } from 'react';
import { reviewApi } from '@/lib/api';

interface Review {
  id: string;
  title: string;
  status: string;
  scheduledDate: string;
  conclusions?: string;
  decisions?: string[];
}

export default function ManagementReviewPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', scheduledDate: '', agenda: '', attendees: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    reviewApi.list().then((r) => { setReviews(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await reviewApi.create({
      ...form,
      attendees: form.attendees.split(',').map((a) => a.trim()).filter(Boolean),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ title: '', scheduledDate: '', agenda: '', attendees: '' });
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Management Review</h2>
          <p className="text-gray-500 text-sm">ISO Clause 9.3 – Leadership management review meetings</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Schedule Review
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Schedule Management Review</h3>
            <input required placeholder="Review Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <textarea placeholder="Agenda items" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input placeholder="Attendee IDs (comma-separated)" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })}
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
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No management reviews scheduled.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div key={rev.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{rev.title}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {rev.scheduledDate ? new Date(rev.scheduledDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  rev.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  rev.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{rev.status}</span>
              </div>
              {rev.conclusions && (
                <p className="mt-3 text-sm text-gray-600 border-t pt-3"><strong>Conclusions:</strong> {rev.conclusions}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
