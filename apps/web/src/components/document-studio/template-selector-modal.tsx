'use client';

import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, FileText, BookOpen, ClipboardList, FileCheck } from 'lucide-react';
import { TEMPLATES, TEMPLATE_GROUPS } from './template-data';
import type { TemplateDefinition } from './template-data';
import { DOC_TYPE_LABELS } from '@/lib/types';

const STANDARD_COLORS: Record<string, { text: string; bg: string }> = {
  iso_9001: { text: '#60a5fa', bg: 'rgba(59,130,246,0.10)' },
  iso_14001: { text: '#4ade80', bg: 'rgba(34,197,94,0.10)' },
  iso_45001: { text: '#fbbf24', bg: 'rgba(245,158,11,0.10)' },
};

const GROUP_COLORS: Record<string, string> = {
  all: '#818CF8',
  iso_9001: '#3B82F6',
  iso_14001: '#22C55E',
  iso_45001: '#F59E0B',
  multi: '#818CF8',
};

const DOC_ICONS: Record<string, typeof FileText> = {
  manual: BookOpen,
  policy: FileCheck,
  procedure: ClipboardList,
  form: FileText,
  record: FileText,
};

interface TemplateSelectorModalProps {
  open: boolean;
  onSelect: (template: TemplateDefinition | null) => void;
  onCancel: () => void;
}

export function TemplateSelectorModal({ open, onSelect, onCancel }: TemplateSelectorModalProps) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (filter !== 'all' && t.group !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.docType.includes(q);
      }
      return true;
    });
  }, [filter, search]);

  const selected = selectedId ? TEMPLATES.find((t) => t.id === selectedId) ?? null : null;

  const handleUse = () => {
    if (selected) onSelect(selected);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl focus:outline-none flex flex-col"
          style={{
            height: '85vh',
            background: 'var(--content-surface)',
            border: '1px solid var(--content-border)',
            color: 'var(--content-text)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--content-border)' }}
          >
            <div>
              <Dialog.Title className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                Choose a Template
              </Dialog.Title>
              <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-muted)' }}>
                Start with a pre-built ISO template or create a blank document.
              </p>
            </div>
            <Dialog.Close className="rounded p-1.5 transition-colors hover:bg-white/10" style={{ color: 'var(--content-text-dim)' }}>
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar — filter */}
            <div
              className="w-[200px] flex-shrink-0 p-4 space-y-1 overflow-y-auto"
              style={{ borderRight: '1px solid var(--content-border)' }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.15em] px-3 mb-2"
                style={{ color: 'var(--content-text-dim)' }}
              >
                Filter by Standard
              </p>
              {TEMPLATE_GROUPS.map((g) => {
                const active = filter === g.value;
                const color = GROUP_COLORS[g.value] ?? '#818CF8';
                return (
                  <button
                    key={g.value}
                    onClick={() => setFilter(g.value)}
                    className="w-full text-left rounded-lg px-3 py-2 text-[13px] transition-all"
                    style={{
                      background: active ? `${color}15` : 'transparent',
                      color: active ? color : 'var(--content-text)',
                      fontWeight: active ? 600 : 400,
                      borderLeft: `2px solid ${active ? color : 'transparent'}`,
                    }}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>

            {/* Main — grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="px-6 pt-4 pb-3 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--content-text-dim)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-4 text-sm outline-none focus:border-white/20"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <p className="text-[11px] mt-2" style={{ color: 'var(--content-text-dim)' }}>
                  {filtered.length} template{filtered.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  {filtered.map((t) => {
                    const isSelected = selectedId === t.id;
                    const Icon = DOC_ICONS[t.docType] ?? FileText;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedId(isSelected ? null : t.id)}
                        className="text-left rounded-xl p-4 transition-all border"
                        style={{
                          borderColor: isSelected ? '#c2fa69' : 'var(--content-border)',
                          background: isSelected ? 'rgba(194,250,105,0.05)' : 'transparent',
                          boxShadow: isSelected ? '0 0 0 1px #c2fa69' : 'none',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(99,102,241,0.10)' }}
                          >
                            <Icon className="h-4 w-4" style={{ color: '#818CF8' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate">{t.title}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span
                                className="rounded-lg px-1.5 py-0.5 text-[9px] font-semibold"
                                style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}
                              >
                                {DOC_TYPE_LABELS[t.docType] ?? t.docType}
                              </span>
                              {t.standards.map((s) => {
                                const c = STANDARD_COLORS[s] ?? { text: '#818CF8', bg: 'rgba(99,102,241,0.10)' };
                                return (
                                  <span
                                    key={s}
                                    className="rounded-lg px-1.5 py-0.5 text-[9px] font-semibold"
                                    style={{ background: c.bg, color: c.text }}
                                  >
                                    {s.replace('iso_', '').toUpperCase()}
                                  </span>
                                );
                              })}
                              {t.isCore && (
                                <span
                                  className="rounded-lg px-1.5 py-0.5 text-[9px] font-bold"
                                  style={{ background: 'rgba(194,250,105,0.12)', color: '#c2fa69' }}
                                >
                                  CORE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <FileText className="h-10 w-10 mb-3" style={{ color: 'var(--content-text-dim)' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--content-text-muted)' }}>
                      No templates match your search
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--content-border)' }}
          >
            <button
              onClick={() => onSelect(null)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <FileText className="h-4 w-4" />
              Blank Document
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                style={{ color: 'var(--content-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleUse}
                disabled={!selected}
                className="rounded-lg px-5 py-2 text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: selected ? '#c2fa69' : 'rgba(194,250,105,0.3)',
                  color: '#0a0f1a',
                }}
              >
                Use Template
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
