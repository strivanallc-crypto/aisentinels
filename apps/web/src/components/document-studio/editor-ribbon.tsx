'use client';

/**
 * EditorRibbon — MS Word-style toolbar for TipTap editor.
 *
 * 5 groups: History | Format | Paragraph | Insert | Doki AI
 */
import type { Editor } from '@tiptap/react';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  WrapText,
  ChevronDown,
  Sparkles,
  RotateCcw,
  BookOpen,
  Palette,
  Highlighter,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────────────────

interface EditorRibbonProps {
  editor: Editor | null;
  readOnly?: boolean;
  onAskDoki?: () => void;
  onImprove?: () => void;
  onIsoClauses?: () => void;
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

const TEXT_COLORS = [
  { label: 'Default', color: null as string | null },
  { label: 'Red', color: '#dc2626' },
  { label: 'Orange', color: '#ea580c' },
  { label: 'Yellow', color: '#ca8a04' },
  { label: 'Green', color: '#16a34a' },
  { label: 'Blue', color: '#2563eb' },
  { label: 'Purple', color: '#7c3aed' },
  { label: 'Gray', color: '#6b7280' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None', color: null as string | null },
  { label: 'Yellow', color: '#fef08a' },
  { label: 'Green', color: '#bbf7d0' },
  { label: 'Red', color: '#fecaca' },
];

// ── Ribbon button ─────────────────────────────────────────────────────────────────────

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
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40"
      style={{
        background: active ? 'rgba(194,250,105,0.15)' : 'transparent',
        color: active ? '#c2fa69' : 'var(--content-text-muted)',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = active ? 'rgba(194,250,105,0.15)' : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────────

function Sep() {
  return (
    <div
      className="mx-1 h-5 w-px flex-shrink-0"
      style={{ background: 'rgba(255,255,255,0.08)' }}
    />
  );
}

// ── Text style dropdown ─────────────────────────────────────────────────────────────────

function StyleDropdown({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
        style={{ color: 'var(--content-text)', background: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span className="min-w-[4.5rem] text-left">{currentLabel}</span>
        <ChevronDown className="h-3 w-3" style={{ color: 'var(--content-text-muted)' }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border py-1 shadow-xl"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          {STYLE_OPTIONS.map((opt) => {
            const isActive =
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
                  color: isActive ? '#c2fa69' : 'var(--text)',
                  background: isActive ? 'rgba(194,250,105,0.1)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(194,250,105,0.1)' : 'transparent';
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

// ── Color picker dropdown ─────────────────────────────────────────────────────────────

function ColorPicker({
  colors,
  onSelect,
  disabled,
  icon: Icon,
  title,
  activeColor,
}: {
  colors: Array<{ label: string; color: string | null }>;
  onSelect: (color: string | null) => void;
  disabled?: boolean;
  icon: React.ElementType;
  title: string;
  activeColor?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <RibbonBtn
        active={!!activeColor}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={title}
      >
        <Icon className="h-3.5 w-3.5" />
      </RibbonBtn>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 rounded-lg border p-2 shadow-xl"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <div className="grid grid-cols-4 gap-1">
            {colors.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => { onSelect(c.color); setOpen(false); }}
                className="h-6 w-6 rounded-md border transition-transform hover:scale-110"
                style={{
                  background: c.color ?? 'var(--text)',
                  borderColor: activeColor === c.color ? '#c2fa69' : 'rgba(255,255,255,0.1)',
                  borderWidth: activeColor === c.color ? '2px' : '1px',
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ribbon ──────────────────────────────────────────────────────────────

export function EditorRibbon({ editor, readOnly, onAskDoki, onImprove, onIsoClauses }: EditorRibbonProps) {
  if (!editor) return null;

  const disabled = readOnly ?? false;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-3 py-1.5"
      style={{
        background: 'var(--card-bg)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* §1 — History */}
      <RibbonBtn
        disabled={disabled || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        disabled={disabled || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Sep />

      {/* §2 — Format */}
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
      <RibbonBtn
        active={editor.isActive('strike')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Sep />

      <StyleDropdown editor={editor} disabled={disabled} />

      <Sep />

      <ColorPicker
        colors={TEXT_COLORS}
        onSelect={(color) => {
          if (color) editor.chain().focus().setColor(color).run();
          else editor.chain().focus().unsetColor().run();
        }}
        disabled={disabled}
        icon={Palette}
        title="Text Color"
        activeColor={(editor.getAttributes('textStyle').color as string) ?? null}
      />
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        onSelect={(color) => {
          if (color) editor.chain().focus().toggleHighlight({ color }).run();
          else editor.chain().focus().unsetHighlight().run();
        }}
        disabled={disabled}
        icon={Highlighter}
        title="Highlight"
        activeColor={(editor.getAttributes('highlight').color as string) ?? null}
      />

      <Sep />

      {/* §3 — Paragraph */}
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

      <Sep />

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
      <RibbonBtn
        active={editor.isActive('blockquote')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        active={editor.isActive('codeBlock')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        <Code2 className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Sep />

      {/* §4 — Insert */}
      <RibbonBtn
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="h-3.5 w-3.5" />
      </RibbonBtn>
      <RibbonBtn
        disabled={disabled}
        onClick={() => editor.chain().focus().setHardBreak().run()}
        title="Hard Break"
      >
        <WrapText className="h-3.5 w-3.5" />
      </RibbonBtn>

      <Sep />

      {/* §5 — Doki AI */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          onClick={onAskDoki}
          disabled={disabled}
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all disabled:pointer-events-none disabled:opacity-40 hover:brightness-110"
          style={{ background: '#c2fa69', color: '#0a0a0a' }}
          title="Ask Doki AI"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask Doki
        </button>
        <button
          type="button"
          onClick={onImprove}
          disabled={disabled || editor.state.selection.empty}
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-40"
          style={{ background: 'rgba(194,250,105,0.12)', color: '#c2fa69' }}
          title="Improve selected text with AI"
        >
          <RotateCcw className="h-3 w-3" />
          Improve
        </button>
        <button
          type="button"
          onClick={onIsoClauses}
          disabled={disabled}
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-40"
          style={{ background: 'rgba(194,250,105,0.12)', color: '#c2fa69' }}
          title="Highlight ISO clause references"
        >
          <BookOpen className="h-3 w-3" />
          ISO Clauses
        </button>
      </div>
    </div>
  );
}
