'use client';

/**
 * TipTapEditor — drop-in rich-text editor with MS Word ribbon.
 *
 * Props:
 *   content     – TipTap-compatible JSON (doc.bodyJsonb)
 *   editable    – true when status === 'draft'
 *   onChange    – called on every update with the JSON content
 *   className   – optional extra classes on the outer wrapper
 *
 * Rendering:
 *   ┌─────────────────────────────────────────┐
 *   │  EditorRibbon (toolbar)                 │
 *   ├─────────────────────────────────────────┤
 *   │                                         │
 *   │  TipTap EditorContent (ProseMirror)     │
 *   │                                         │
 *   └─────────────────────────────────────────┘
 *
 * Theme: --content-surface bg, --content-text text, --content-border border.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { EditorRibbon } from './editor-ribbon';
import { useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TipTapEditorProps {
  /** TipTap JSON content (doc.bodyJsonb) */
  content: Record<string, unknown> | null | undefined;
  /** Whether the editor is editable (draft status) */
  editable?: boolean;
  /** Callback on every content change — receives TipTap JSON */
  onChange?: (json: Record<string, unknown>) => void;
  /** Optional extra classes */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TipTapEditor({
  content,
  editable = false,
  onChange,
  className,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start typing your document content…',
      }),
      CharacterCount,
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getJSON() as Record<string, unknown>);
    },
  });

  // Sync editable prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync external content changes (e.g. after Doki generation)
  useEffect(() => {
    if (editor && content) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  return (
    <div className={className}>
      {/* Ribbon toolbar */}
      <EditorRibbon editor={editor} readOnly={!editable} />

      {/* Editor area */}
      <div className="p-6">
        <EditorContent editor={editor} />
      </div>

      {/* ProseMirror / TipTap Styles */}
      <style jsx global>{`
        /* ── TipTap editor content styles ─────────────────────────── */
        .tiptap-editor-content {
          outline: none;
          min-height: 300px;
          color: var(--content-text);
          font-size: 0.875rem;
          line-height: 1.7;
        }

        .tiptap-editor-content h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
          color: var(--content-text);
        }

        .tiptap-editor-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          line-height: 1.35;
          color: var(--content-text);
        }

        .tiptap-editor-content h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
          color: var(--content-text);
        }

        .tiptap-editor-content p {
          margin-bottom: 0.5rem;
        }

        .tiptap-editor-content ul,
        .tiptap-editor-content ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .tiptap-editor-content ul {
          list-style-type: disc;
        }

        .tiptap-editor-content ol {
          list-style-type: decimal;
        }

        .tiptap-editor-content li {
          margin-bottom: 0.25rem;
        }

        .tiptap-editor-content li p {
          margin-bottom: 0;
        }

        .tiptap-editor-content blockquote {
          padding-left: 1rem;
          border-left: 3px solid var(--content-border);
          color: var(--content-text-muted);
          margin: 0.75rem 0;
        }

        .tiptap-editor-content code {
          background: rgba(255, 255, 255, 0.06);
          padding: 0.15rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
        }

        .tiptap-editor-content pre {
          background: rgba(0, 0, 0, 0.3);
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 0.75rem 0;
        }

        .tiptap-editor-content pre code {
          background: none;
          padding: 0;
        }

        .tiptap-editor-content hr {
          border: none;
          border-top: 1px solid var(--content-border);
          margin: 1.5rem 0;
        }

        /* Placeholder */
        .tiptap-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--content-text-dim);
          pointer-events: none;
          height: 0;
        }

        /* Read-only cursor */
        .ProseMirror[contenteditable="false"] {
          cursor: default;
        }

        /* Focus ring for editable */
        .ProseMirror[contenteditable="true"]:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
