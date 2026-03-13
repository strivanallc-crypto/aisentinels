'use client';

/**
 * ClauseSidebar — Collapsible right panel showing ISO Annex SL clause references.
 * Clicking a chip inserts "[ISO 9001:4.1]" at the TipTap editor cursor.
 */
import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ClauseSidebarProps {
  editor: Editor | null;
  standards: string[];
  createdAt?: string;
  updatedAt?: string;
}

const ISO_CLAUSE_MAP: Record<string, string> = {
  '4.1': 'Context',
  '4.2': 'Interested parties',
  '4.3': 'Scope',
  '5.1': 'Leadership',
  '5.2': 'Policy',
  '5.3': 'Roles',
  '6.1': 'Risks',
  '6.2': 'Objectives',
  '7.1': 'Resources',
  '7.2': 'Competence',
  '7.3': 'Awareness',
  '7.4': 'Communication',
  '7.5': 'Documented info',
  '8.1': 'Operations',
  '9.1': 'Monitoring',
  '9.2': 'Internal audit',
  '9.3': 'Mgmt review',
  '10.2': 'CAPA',
  '10.3': 'Improvement',
};

const STANDARD_LABELS: Record<string, string> = {
  iso_9001: 'ISO 9001',
  iso_14001: 'ISO 14001',
  iso_45001: 'ISO 45001',
};

const STANDARD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  iso_9001: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  iso_14001: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  iso_45001: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
};

export function ClauseSidebar({ editor, standards, createdAt, updatedAt }: ClauseSidebarProps) {
  const [open, setOpen] = useState(true);

  const handleInsertClause = (clauseNum: string) => {
    if (!editor) return;
    const std = standards[0] ? STANDARD_LABELS[standards[0]] ?? 'ISO' : 'ISO';
    const ref = `[${std}:${clauseNum}]`;
    editor.chain().focus().insertContent(ref).run();
  };

  return (
    <div
      className="relative flex-shrink-0 h-full transition-all duration-200"
      style={{
        width: open ? 200 : 0,
        overflow: 'hidden',
        background: 'var(--bg-surface, #0f1729)',
        borderLeft: open ? '1px solid var(--border, #1e2d4a)' : 'none',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute -left-6 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-l-md"
        style={{
          background: 'var(--bg-elevated, #151f35)',
          border: '1px solid var(--border, #1e2d4a)',
          borderRight: 'none',
          color: 'var(--text-muted, #4a5a78)',
        }}
      >
        {open ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className="h-full overflow-y-auto px-3 py-4 space-y-4" style={{ minWidth: 200 }}>
        {/* Section label — Sadewa pattern */}
        <div className="flex items-center gap-2">
          <span style={{ color: '#c2fa69' }} className="text-xs font-medium">/</span>
          <span
            className="text-[10px] uppercase tracking-[0.15em] font-medium"
            style={{ color: 'var(--text-muted, #4a5a78)' }}
          >
            Clause References
          </span>
        </div>

        {/* Standard filter pills */}
        {standards.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {standards.map((s) => {
              const colors = STANDARD_COLORS[s];
              return (
                <span
                  key={s}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border"
                  style={{
                    background: colors?.bg ?? 'rgba(99,102,241,0.12)',
                    color: colors?.text ?? '#818CF8',
                    borderColor: colors?.border ?? 'rgba(99,102,241,0.3)',
                  }}
                >
                  {STANDARD_LABELS[s] ?? s}
                </span>
              );
            })}
          </div>
        )}

        {/* Clause chips */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ISO_CLAUSE_MAP).map(([num, label]) => (
            <button
              key={num}
              onClick={() => handleInsertClause(num)}
              className="text-[10px] px-2 py-1 rounded border cursor-pointer transition-colors"
              style={{
                background: 'transparent',
                borderColor: 'var(--border, #1e2d4a)',
                color: 'var(--text-secondary, #8899bb)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated, #151f35)';
                e.currentTarget.style.borderColor = '#c2fa69';
                e.currentTarget.style.color = '#c2fa69';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border, #1e2d4a)';
                e.currentTarget.style.color = 'var(--text-secondary, #8899bb)';
              }}
              title={`Insert [ISO:${num}] — ${label}`}
            >
              {num} {label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="pt-2 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: '#c2fa69' }} className="text-xs font-medium">/</span>
            <span
              className="text-[10px] uppercase tracking-[0.15em] font-medium"
              style={{ color: 'var(--text-muted, #4a5a78)' }}
            >
              Timeline
            </span>
          </div>
          {createdAt && (
            <div className="flex justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted, #4a5a78)' }}>Created</span>
              <span style={{ color: 'var(--text-secondary, #8899bb)' }}>
                {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
          {updatedAt && (
            <div className="flex justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted, #4a5a78)' }}>Updated</span>
              <span style={{ color: 'var(--text-secondary, #8899bb)' }}>
                {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
