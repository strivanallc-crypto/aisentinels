'use client';

/**
 * EditorRibbon — MS Word-style toolbar for TipTap editor.
 *
 * 5 sections (left → right):
 *   1. Text style dropdown (Normal / H1 / H2 / H3)
 *   2. Basic formatting (Bold / Italic / Underline)
 *   3. Lists (Bullet / Ordered)
 *   4. Text alignment (Left / Center / Right / Justify)
 *   5. Document actions (Copy / Word count)
 *
 * Theme: --content-bg background, --content-border dividers, --content-text text.
 * Disabled state: all buttons disabled + 50% opacity when readOnly.
 */
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditorRibbonProps {
  editor: Editor | null;
  readOnly?: boolean;
}

type HeadingLevel = 1 | 2 | 3;

interface StyleOption {
  label: string;
  value: 'paragraph' | 'heading';
  level?: HeadingLevel;
}

const STYLE_OPTIONS: StyleOption[] = [
  { label: 'Normal', value: 'paragraph' },
  { label: 'Heading 1', value: 'heading', level: 1 },
  { label: 'Heading 2', value: 'heading', level: 2 },
  { label: 'Heading 3', value: 'heading', level: 3 },
];

// ── Ribbon button ─────────────────────────────────────────────────────────────

function RibbonBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
      style={{
        background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
        color: active ? '#a5b4fc' : 'var(--content-text-muted)',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) (e.currentTarget.style.background = 'rgba(255,255,255,0.07)');
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget.style.background = 'transparent');
      }}
    >
      {children}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────

function Separator() {
  return (
    <div
      className="mx-1.5 h-5 w-px flex-shrink-0"
      style={{ background: 'var(--content-border)' }}
    />
  );
}

// ── Text style dropdown ──────────────────────────────────────────────────────

function StyleDropdown({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = (() => {
    for (const opt of STYLE_OPTIONS) {
      if (opt.value === 'heading' && opt.level && editor.isActive('heading', { level: opt.level })) {
        return opt.label;
      }
    }
    return 'Normal';
  })();

  const apply = (opt: StyleOption) => {
    if (opt.value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else if (opt.level) {
      editor.chain().focus().toggleHeading({ level: opt.level }).run();
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
        style={{ color: 'var(--content-text)', background: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span className="min-w-[4.5rem] text-left">{currentLabel}</span>
        <ChevronDown className="h-3 w-3" style={{ color: 'var(--content-text-muted)' }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border py-1 shadow-xl"
          style={{
            background: 'var(--content-bg)',
            borderColor: 'var(--content-border)',
          }}
        >
          {STYLE_OPTIONS.map((opt) => {
            const active =
              opt.value === 'paragraph'
                ? !editor.isActive('heading')
                : editor.isActive('heading', { level: opt.level });
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => apply(opt)}
                className="flex w-full items-center px-3 py-1.5 text-xs transition-colors"
                style={{
                  color: active ? '#a5b4fc' : 'var(--content-text)',
                  background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ribbon ──────────────────────────────────────────────────────────────

export function EditorRibbon({ editor, readOnly }: EditorRibbonProps) {
  const [copied, setCopied] = useState(false);

  if (!editor) return null;

  const disabled = readOnly ?? false;

  const handleCopy = () => {
    const text = editor.getText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const wordCount = editor.storage.characterCount?.words() ?? 0;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-3 py-1.5"
      style={{
        background: 'var(--content-bg)',
        borderBottom: '1px solid var(--content-border)',
      }}
    >
      {/* §1 — Text style dropdown */}
      <StyleDropdown editor={editor} disabled={disabled} />

      <Separator />

      {/* §2 — Basic formatting */}
      <RibbonBtn
        active={editor.isActive('bold')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive('italic')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive('underline')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Separator />

      {/* §3 — Lists */}
      <RibbonBtn
        active={editor.isActive('bulletList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive('orderedList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Separator />

      {/* §4 — Text alignment */}
      <RibbonBtn
        active={editor.isActive({ textAlign: 'left' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Align Left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive({ textAlign: 'center' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Align Center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive({ textAlign: 'right' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Align Right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive({ textAlign: 'justify' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        title="Justify"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Separator />

      {/* §5 — Document actions */}
      <RibbonBtn
        active={false}
        disabled={false}
        onClick={handleCopy}
        title="Copy all text"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </RibbonBtn>

      {/* Word/char count — right side */}
      <div className="ml-auto flex items-center gap-2 text-[10px] tabular-nums" style={{ color: 'var(--content-text-dim)' }}>
        <span>{wordCount.toLocaleString()} words</span>
        <span>&middot;</span>
        <span>{charCount.toLocaleString()} chars</span>
      </div>
    </div>
  );
}
