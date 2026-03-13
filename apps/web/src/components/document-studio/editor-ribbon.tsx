'use client';

/**
 * EditorRibbon — MS Word-style 7-group toolbar for TipTap editor.
 *
 * Groups: History | Clipboard | Text Format | Paragraph Style |
 *         Lists & Structure | Insert Objects | Doki AI
 *
 * Design tokens: bg-surface #0f1729, bg-elevated #151f35,
 *                border #1e2d4a, lime accent #c2fa69
 */
import type { Editor } from '@tiptap/react';
import {
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  RemoveFormatting,
  Palette,
  Highlighter,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Indent,
  Outdent,
  Minus,
  ImagePlus,
  Table,
  Link2,
  Code2,
  Quote,
  Sparkles,
  RotateCcw,
  Maximize2,
  FileText,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────────────────

interface EditorRibbonProps {
  editor: Editor | null;
  readOnly?: boolean;
}

type HeadingLevel = 1 | 2 | 3;

interface StyleOption {
  label: string;
  value: 'paragraph' | 'heading' | 'blockquote' | 'codeBlock';
  level?: HeadingLevel;
}

const STYLE_OPTIONS: StyleOption[] = [
  { label: 'Normal', value: 'paragraph' },
  { label: 'Heading 1', value: 'heading', level: 1 },
  { label: 'Heading 2', value: 'heading', level: 2 },
  { label: 'Heading 3', value: 'heading', level: 3 },
  { label: 'Quote', value: 'blockquote' },
  { label: 'Code Block', value: 'codeBlock' },
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
  { label: 'Blue', color: '#bfdbfe' },
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
        color: active ? '#c2fa69' : '#94a3b8',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? 'rgba(194,250,105,0.15)' : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────────

function Sep() {
  return <div className="mx-1.5 h-5 w-px flex-shrink-0" style={{ background: '#1e2d4a' }} />;
}

// ── Group label (above the icons, Word-style) ──────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-center text-[10px] leading-none pt-1" style={{ color: '#475569' }}>
      {children}
    </span>
  );
}

// ── Style dropdown ─────────────────────────────────────────────────────────────────────

function StyleDropdown({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
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
    if (editor.isActive('codeBlock')) return 'Code Block';
    if (editor.isActive('blockquote')) return 'Quote';
    for (const opt of STYLE_OPTIONS) {
      if (opt.value === 'heading' && opt.level && editor.isActive('heading', { level: opt.level }))
        return opt.label;
    }
    return 'Normal';
  })();

  const apply = (opt: StyleOption) => {
    switch (opt.value) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading':
        if (opt.level) editor.chain().focus().toggleHeading({ level: opt.level }).run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
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
        style={{ color: '#e2e8f0', background: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span className="min-w-[5rem] text-left">{currentLabel}</span>
        <ChevronDown className="h-3 w-3" style={{ color: '#94a3b8' }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[150px] rounded-lg border py-1 shadow-xl"
          style={{ background: '#151f35', borderColor: '#1e2d4a' }}
        >
          {STYLE_OPTIONS.map((opt) => {
            const isActive =
              opt.value === 'paragraph'
                ? !editor.isActive('heading') && !editor.isActive('blockquote') && !editor.isActive('codeBlock')
                : opt.value === 'heading'
                  ? editor.isActive('heading', { level: opt.level })
                  : editor.isActive(opt.value);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => apply(opt)}
                className="flex w-full items-center px-3 py-1.5 text-xs transition-colors"
                style={{
                  color: isActive ? '#c2fa69' : '#e2e8f0',
                  background: isActive ? 'rgba(194,250,105,0.1)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? 'rgba(194,250,105,0.1)' : 'transparent';
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

// ── Color picker ──────────────────────────────────────────────────────────────────────

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
      <RibbonBtn active={!!activeColor} disabled={disabled} onClick={() => setOpen((v) => !v)} title={title}>
        <Icon className="h-3.5 w-3.5" />
      </RibbonBtn>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 rounded-lg border p-2 shadow-xl"
          style={{ background: '#151f35', borderColor: '#1e2d4a' }}
        >
          <div className="grid grid-cols-4 gap-1">
            {colors.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => { onSelect(c.color); setOpen(false); }}
                className="h-6 w-6 rounded-md border transition-transform hover:scale-110"
                style={{
                  background: c.color ?? '#e2e8f0',
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

// ── Table grid picker ─────────────────────────────────────────────────────────────────

function TableGridPicker({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const insert = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <RibbonBtn disabled={disabled} onClick={() => setOpen((v) => !v)} title="Insert Table">
        <Table className="h-3.5 w-3.5" />
      </RibbonBtn>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 rounded-lg border p-2 shadow-xl"
          style={{ background: '#151f35', borderColor: '#1e2d4a' }}
        >
          <p className="mb-1 text-[10px]" style={{ color: '#94a3b8' }}>
            {hover ? `${hover.r} × ${hover.c}` : 'Select size'}
          </p>
          <div className="grid grid-cols-5 gap-0.5">
            {Array.from({ length: 5 }, (_, r) =>
              Array.from({ length: 5 }, (_, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className="h-4 w-4 rounded-sm border"
                  style={{
                    borderColor: '#1e2d4a',
                    background:
                      hover && r + 1 <= hover.r && c + 1 <= hover.c
                        ? 'rgba(194,250,105,0.3)'
                        : 'transparent',
                  }}
                  onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => insert(r + 1, c + 1)}
                />
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Link button ───────────────────────────────────────────────────────────────────────

function LinkButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const toggleLink = useCallback(() => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  return (
    <RibbonBtn active={editor.isActive('link')} disabled={disabled} onClick={toggleLink} title="Link (Ctrl+K)">
      <Link2 className="h-3.5 w-3.5" />
    </RibbonBtn>
  );
}

// ── Image button ──────────────────────────────────────────────────────────────────────

function ImageButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [editor],
  );

  return (
    <>
      <RibbonBtn disabled={disabled} onClick={() => fileRef.current?.click()} title="Insert Image">
        <ImagePlus className="h-3.5 w-3.5" />
      </RibbonBtn>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </>
  );
}

// ── Main ribbon ──────────────────────────────────────────────────────────────────────

export function EditorRibbon({ editor, readOnly }: EditorRibbonProps) {
  if (!editor) return null;
  const d = readOnly ?? false;

  return (
    <div
      className="flex flex-col"
      style={{ background: '#0f1729', borderBottom: '1px solid #1e2d4a' }}
    >
      {/* Icon row */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1">
        {/* §1 — History */}
        <RibbonBtn disabled={d || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn disabled={d || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo2 className="h-3.5 w-3.5" />
        </RibbonBtn>

        <Sep />

        {/* §2 — Clipboard */}
        <RibbonBtn disabled={d} onClick={() => document.execCommand('cut')} title="Cut (Ctrl+X)">
          <Scissors className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn disabled={d} onClick={() => document.execCommand('copy')} title="Copy (Ctrl+C)">
          <Copy className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn disabled={d} onClick={() => document.execCommand('paste')} title="Paste (Ctrl+V)">
          <ClipboardPaste className="h-3.5 w-3.5" />
        </RibbonBtn>

        <Sep />

        {/* §3 — Text Format */}
        <RibbonBtn active={editor.isActive('bold')} disabled={d} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('italic')} disabled={d} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('underline')} disabled={d} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <Underline className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('strike')} disabled={d} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('subscript')} disabled={d} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
          <Subscript className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('superscript')} disabled={d} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
          <Superscript className="h-3.5 w-3.5" />
        </RibbonBtn>

        <ColorPicker
          colors={TEXT_COLORS}
          onSelect={(color) => {
            if (color) editor.chain().focus().setColor(color).run();
            else editor.chain().focus().unsetColor().run();
          }}
          disabled={d}
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
          disabled={d}
          icon={Highlighter}
          title="Highlight"
          activeColor={(editor.getAttributes('highlight').color as string) ?? null}
        />

        <RibbonBtn disabled={d} onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Clear Formatting">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </RibbonBtn>

        <Sep />

        {/* §4 — Paragraph Style */}
        <StyleDropdown editor={editor} disabled={d} />

        <RibbonBtn active={editor.isActive({ textAlign: 'left' })} disabled={d} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive({ textAlign: 'center' })} disabled={d} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive({ textAlign: 'right' })} disabled={d} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive({ textAlign: 'justify' })} disabled={d} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justify">
          <AlignJustify className="h-3.5 w-3.5" />
        </RibbonBtn>

        <Sep />

        {/* §5 — Lists & Structure */}
        <RibbonBtn active={editor.isActive('bulletList')} disabled={d} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('orderedList')} disabled={d} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('taskList')} disabled={d} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task List">
          <ListChecks className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn disabled={d} onClick={() => editor.chain().focus().sinkListItem('listItem').run()} title="Increase Indent">
          <Indent className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn disabled={d} onClick={() => editor.chain().focus().liftListItem('listItem').run()} title="Decrease Indent">
          <Outdent className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn disabled={d} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="h-3.5 w-3.5" />
        </RibbonBtn>

        <Sep />

        {/* §6 — Insert Objects */}
        <ImageButton editor={editor} disabled={d} />
        <TableGridPicker editor={editor} disabled={d} />
        <LinkButton editor={editor} disabled={d} />
        <RibbonBtn active={editor.isActive('codeBlock')} disabled={d} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
          <Code2 className="h-3.5 w-3.5" />
        </RibbonBtn>
        <RibbonBtn active={editor.isActive('blockquote')} disabled={d} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className="h-3.5 w-3.5" />
        </RibbonBtn>

        <Sep />

        {/* §7 — Doki AI (placeholder — uses Doki panel at page level) */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            disabled={d}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all disabled:pointer-events-none disabled:opacity-40 hover:brightness-110"
            style={{ background: '#6366F1', color: '#ffffff' }}
            title="Ask Doki AI (opens panel)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask Doki
          </button>
          <button
            type="button"
            disabled={d || editor.state.selection.empty}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
            title="Improve selected text"
          >
            <RotateCcw className="h-3 w-3" />
            Improve
          </button>
          <button
            type="button"
            disabled={d || editor.state.selection.empty}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
            title="Expand selected text"
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </button>
          <button
            type="button"
            disabled={d || editor.state.selection.empty}
            className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-40"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
            title="Summarize selected text"
          >
            <FileText className="h-3 w-3" />
            Summarize
          </button>
        </div>
      </div>

      {/* Group labels row */}
      <div className="flex items-center gap-0.5 px-3 pb-1">
        <div className="flex" style={{ width: '58px' }}><GroupLabel>History</GroupLabel></div>
        <div className="mx-1.5 w-px" />
        <div className="flex" style={{ width: '70px' }}><GroupLabel>Clipboard</GroupLabel></div>
        <div className="mx-1.5 w-px" />
        <div className="flex" style={{ width: '230px' }}><GroupLabel>Text Format</GroupLabel></div>
        <div className="mx-1.5 w-px" />
        <div className="flex" style={{ width: '175px' }}><GroupLabel>Paragraph</GroupLabel></div>
        <div className="mx-1.5 w-px" />
        <div className="flex" style={{ width: '150px' }}><GroupLabel>Lists</GroupLabel></div>
        <div className="mx-1.5 w-px" />
        <div className="flex" style={{ width: '120px' }}><GroupLabel>Insert</GroupLabel></div>
        <div className="mx-1.5 w-px" />
        <div className="flex-1 text-right"><GroupLabel>Doki AI</GroupLabel></div>
      </div>
    </div>
  );
}
