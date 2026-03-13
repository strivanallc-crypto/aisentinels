'use client';

import { useState } from 'react';
import { recordsApi } from '@/lib/api';
import type { RecordCategory } from '@/lib/types';
import { RECORD_CATEGORY_LABELS } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

const CATEGORIES = Object.entries(RECORD_CATEGORY_LABELS) as [RecordCategory, string][];

interface CreateRecordForm {
  title: string;
  category: RecordCategory;
  retentionYears: number;
  contentText: string;
}

const EMPTY_FORM: CreateRecordForm = {
  title: '', category: 'quality', retentionYears: 7, contentText: '',
};

interface CreateRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateRecordModal({ open, onOpenChange, onCreated }: CreateRecordModalProps) {
  const [form, setForm] = useState<CreateRecordForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleClose = (o: boolean) => {
    onOpenChange(o);
    if (!o) setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await recordsApi.create({
        title: form.title.trim(),
        category: form.category,
        retentionYears: form.retentionYears,
        contentText: form.contentText.trim() || undefined,
      });
      handleClose(false);
      onCreated();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={handleClose} title="New Record">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Title</label>
          <input
            type="text" required value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Supplier Qualification Record Q-2024-001"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Category</label>
            <select
              required value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RecordCategory }))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
            >
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Retention (years)</label>
            <input
              type="number" min={1} max={99} value={form.retentionYears}
              onChange={(e) => setForm((f) => ({ ...f, retentionYears: Number(e.target.value) }))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Content <span style={{ color: 'var(--content-text-dim)' }}>(optional)</span>
          </label>
          <textarea
            rows={4} value={form.contentText}
            onChange={(e) => setForm((f) => ({ ...f, contentText: e.target.value }))}
            placeholder="Record content..."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Record'}</Button>
        </div>
      </form>
    </Modal>
  );
}
