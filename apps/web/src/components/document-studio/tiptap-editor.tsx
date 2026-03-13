'use client';

/**
 * TipTapEditor — premium rich-text editor with MS Word ribbon,
 * A4 document canvas, status bar, and auto-save.
 * Doki AI panel moved to page-level DokiCoPilot component.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import ImageExt from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Typography from '@tiptap/extension-typography';
import Gapcursor from '@tiptap/extension-gapcursor';
import { EditorRibbon } from './editor-ribbon';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';

// ── Types ───────────────────────────────────────────────────────────────────────────
export interface TipTapEditorProps {
  content: Record<string, unknown> | null | undefined;
  editable?: boolean;
  onChange?: (json: Record<string, unknown>) => void;
  onSave?: (json: Record<string, unknown>) => Promise<void>;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

// ── Component ───────────────────────────────────────────────────────────────────────
export function TipTapEditor({
  content,
  editable = false,
  onChange,
  onSave,
  onEditorReady,
  className,
}: TipTapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorReadyFired = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start typing your document content\u2026' }),
      CharacterCount,
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      // TODO Phase H: swap to S3 presigned URL via documentsApi.uploadAsset()
      ImageExt.configure({ inline: false, allowBase64: true }),
      Subscript,
      Superscript,
      Typography,
      Gapcursor,
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = files[0];
        if (!file.type.startsWith('image/')) return false;
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const alt = file.name;
          view.dispatch(
            view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.image.create({ src, alt }),
            ),
          );
        };
        reader.readAsDataURL(file);
        return true;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            const reader = new FileReader();
            reader.onload = () => {
              const src = reader.result as string;
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src, alt: 'Pasted image' }),
                ),
              );
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as Record<string, unknown>;
      onChange?.(json);
      if (editable && onSave) {
        setSaveStatus('unsaved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          setSaveStatus('saving');
          onSave(json)
            .then(() => setSaveStatus('saved'))
            .catch(() => setSaveStatus('error'));
        }, 2000);
      }
    },
  });

  // Expose editor to parent
  useEffect(() => {
    if (editor && onEditorReady && !editorReadyFired.current) {
      editorReadyFired.current = true;
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync editable prop
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync external content
  useEffect(() => {
    if (editor && content) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const charCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  const statusDot = {
    saved: '#22C55E',
    unsaved: '#F59E0B',
    saving: '#3B82F6',
    error: '#dc2626',
  }[saveStatus];

  const statusText = {
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving\u2026',
    error: 'Save failed \u2014 retry',
  }[saveStatus];

  return (
    <div className={`flex flex-col h-full relative ${className ?? ''}`}>
      {/* Ribbon toolbar */}
      <div className="sticky top-0 z-10">
        <EditorRibbon editor={editor} readOnly={!editable} />
      </div>

      {/* Document canvas — A4 spec */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--bg-base, #0a0f1a)' }}
      >
        <div className="mx-auto my-8" style={{ maxWidth: 794 }}>
          <div
            className="rounded-sm"
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
              padding: '64px',
              minHeight: 1123,
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="sticky bottom-0 flex items-center justify-between px-4 py-1.5 text-[11px] tabular-nums z-10"
        style={{
          background: 'var(--bg-surface, #0f1729)',
          borderTop: '1px solid var(--border, #1e2d4a)',
          color: 'var(--text-muted, #4a5a78)',
        }}
      >
        <div className="flex items-center gap-3">
          <span>Words: {wordCount.toLocaleString()}</span>
          <span>&middot;</span>
          <span>Characters: {charCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {saveStatus === 'saving' ? (
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: statusDot }} />
          ) : (
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: statusDot }} />
          )}
          <span style={{ color: statusDot }}>{statusText}</span>
        </div>
      </div>

      {/* ProseMirror / TipTap Styles */}
      <style jsx global>{`
        .tiptap-editor-content {
          outline: none;
          min-height: 400px;
          color: #0a0a0a;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          line-height: 1.8;
        }

        .tiptap-editor-content h1 {
          font-size: 24px;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
          color: #0a0a0a;
          font-family: Syne, sans-serif;
        }

        .tiptap-editor-content h2 {
          font-size: 20px;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          line-height: 1.35;
          color: #0a0a0a;
          font-family: Syne, sans-serif;
        }

        .tiptap-editor-content h3 {
          font-size: 16px;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
          color: #0a0a0a;
          font-family: Syne, sans-serif;
        }

        .tiptap-editor-content h4 {
          font-size: 14px;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
          color: #0a0a0a;
          font-family: Syne, sans-serif;
        }

        .tiptap-editor-content p { margin-bottom: 0.5rem; }

        .tiptap-editor-content ul,
        .tiptap-editor-content ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .tiptap-editor-content ul { list-style-type: disc; }
        .tiptap-editor-content ol { list-style-type: decimal; }
        .tiptap-editor-content li { margin-bottom: 0.25rem; }
        .tiptap-editor-content li p { margin-bottom: 0; }

        .tiptap-editor-content blockquote {
          padding-left: 16px;
          border-left: 3px solid #c2fa69;
          color: #4b5563;
          font-style: italic;
          margin: 0.75rem 0;
        }

        .tiptap-editor-content code {
          background: rgba(0, 0, 0, 0.06);
          padding: 0.15rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          color: #0a0a0a;
        }

        .tiptap-editor-content pre {
          background: #1a1a1a;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.75rem 0;
        }

        .tiptap-editor-content pre code {
          background: none;
          padding: 0;
          color: #c2fa69;
        }

        .tiptap-editor-content hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1.5rem 0;
        }

        .tiptap-editor-content a {
          color: #2563eb;
          text-decoration: underline;
        }

        .tiptap-editor-content mark {
          border-radius: 2px;
          padding: 0 2px;
        }

        .tiptap-editor-content img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 0.5rem 0;
        }

        /* Tables */
        .tiptap-editor-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.75rem 0;
        }

        .tiptap-editor-content th,
        .tiptap-editor-content td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
          vertical-align: top;
        }

        .tiptap-editor-content th {
          background: #f3f4f6;
          font-weight: 600;
          font-size: 14px;
        }

        .tiptap-editor-content td { font-size: 14px; }

        /* Task list */
        .tiptap-editor-content ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .tiptap-editor-content ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .tiptap-editor-content ul[data-type="taskList"] li label {
          flex-shrink: 0;
          margin-top: 4px;
        }

        .tiptap-editor-content ul[data-type="taskList"] li label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #c2fa69;
          cursor: pointer;
        }

        .tiptap-editor-content ul[data-type="taskList"] li div { flex: 1; }

        .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: #c2fa69;
          pointer-events: none;
        }

        .tableWrapper { overflow-x: auto; }

        .selectedCell::after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(194, 250, 105, 0.08);
          pointer-events: none;
        }

        .tiptap-editor-content hr.page-break {
          border: none;
          border-top: 2px dashed #d1d5db;
          margin: 2rem 0;
          page-break-after: always;
        }

        .tiptap-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }

        .ProseMirror[contenteditable="false"] { cursor: default; }
        .ProseMirror[contenteditable="true"]:focus { outline: none; }
        .resize-cursor { cursor: col-resize; }
      `}</style>
    </div>
  );
}
