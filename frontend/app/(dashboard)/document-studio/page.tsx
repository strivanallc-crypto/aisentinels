'use client';

import { useEffect, useState } from 'react';
import { documentsApi } from '@/lib/api';
import { Plus, FileText, X, ChevronRight } from 'lucide-react';

interface Document {
  id: string; title: string; type: string;
  status: string; version: string; updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  PROCEDURE: 'Procedure', WORK_INSTRUCTION: 'Work Instruction',
  POLICY: 'Policy', FORM: 'Form', RECORD: 'Record',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  DRAFT:        { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  UNDER_REVIEW: { bg: '#fefce8', color: '#a16207', dot: '#eab308' },
  APPROVED:     { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  OBSOLETE:     { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
};

const FIELD = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function DocumentStudioPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'PROCEDURE', content: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    documentsApi.list().then(r => { setDocs(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await documentsApi.create(form);
    setSaving(false); setOpen(false);
    setForm({ title: '', type: 'PROCEDURE', content: '' }); load();
  };

  return (
    <div className="p-8 max-w-6xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: '#9ca3af' }}>
            <span>ISO Platform</span><ChevronRight className="h-3 w-3" /><span style={{ color: '#374151' }}>Document Studio</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Document Studio</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Controlled document lifecycle management</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: '#2563eb' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1d4ed8'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#2563eb'; }}
        >
          <Plus className="h-4 w-4" /> New Document
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: '#f3f4f6' }} />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#eff6ff' }}>
              <FileText className="h-7 w-7" style={{ color: '#2563eb' }} />
            </div>
            <p className="font-medium" style={{ color: '#374151' }}>No documents yet</p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>Create your first controlled document</p>
            <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: '#2563eb' }}>
              <Plus className="h-4 w-4" /> New Document
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid #f3f4f6' }}>
              <tr style={{ background: '#fafafa' }}>
                {['Title', 'Type', 'Version', 'Status', 'Last Updated'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => {
                const s = STATUS_STYLE[doc.status] ?? STATUS_STYLE.DRAFT;
                return (
                  <tr key={doc.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid #f9fafb' : 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    className="transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-medium" style={{ color: '#111827' }}>
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9ca3af' }} />
                        {doc.title}
                      </div>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#6b7280' }}>{TYPE_LABELS[doc.type] ?? doc.type}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#6b7280' }}>v{doc.version}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: s.bg, color: s.color }}>
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: '#9ca3af' }}>{new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
          <form onSubmit={handleCreate} className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
              <h2 className="font-semibold" style={{ color: '#111827' }}>New Document</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 transition-colors" style={{ color: '#9ca3af' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f3f4f6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Document Title</label>
                <input required placeholder="e.g. Quality Management Procedure" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Document Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827' }}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Content <span style={{ color: '#9ca3af' }}>(optional)</span></label>
                <textarea placeholder="Paste procedure content, policies, or process descriptions…" value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })} rows={5}
                  className={FIELD} style={{ borderColor: '#e5e7eb', color: '#111827', resize: 'none' }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb' }}>Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: '#2563eb' }}>
                {saving ? 'Creating…' : 'Create Document'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
