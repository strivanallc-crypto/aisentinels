'use client';

/**
 * TipTapEditor — premium rich-text editor with MS Word ribbon,
 * A4 document canvas, status bar, auto-save, Doki AI sidebar,
 * and ISO clause highlighting.
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
import { EditorRibbon } from './editor-ribbon';
import { useEffect, useRef, useState, useCallback } from 'react';
import { aiApi } from '@/lib/api';
import { X, Sparkles, Loader2, ArrowDownToLine, Replace } from 'lucide-react';

// ── ISO Clause Map (Annex SL) ────────────────────────────────────────────────────────────────────────

const ISO_CLAUSE_MAP: Record<string, string> = {
  '4.1': 'Understanding the organization and its context',
  '4.2': 'Understanding the needs and expectations of interested parties',
  '4.3': 'Determining the scope of the management system',
  '4.4': 'Management system and its processes',
  '5.1': 'Leadership and commitment',
  '5.2': 'Policy',
  '5.3': 'Organizational roles, responsibilities and authorities',
  '6.1': 'Actions to address risks and opportunities',
  '6.2': 'Objectives and planning to achieve them',
  '7.1': 'Resources',
  '7.2': 'Competence',
  '7.3': 'Awareness',
  '7.4': 'Communication',
  '7.5': 'Documented information',
  '8.1': 'Operational planning and control',
  '8.2': 'Requirements for products and services',
  '8.3': 'Design and development',
  '8.4': 'Control of externally provided processes',
  '8.5': 'Production and service provision',
  '8.6': 'Release of products and services',
  '8.7': 'Control of nonconforming outputs',
  '9.1': 'Monitoring, measurement, analysis and evaluation',
  '9.2': 'Internal audit',
  '9.3': 'Management review',
  '10.1': 'Nonconformity and corrective action',
  '10.2': 'Continual improvement',
};

// ── Types ───────────────────────────────────────────────────────────────────────────────

export interface TipTapEditorProps {
  content: Record<string, unknown> | null | undefined;
  editable?: boolean;
  onChange?: (json: Record<string, unknown>) => void;
  onSave?: (json: Record<string, unknown>) => Promise<void>;
  className?: string;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

// ── Component ───────────────────────────────────────────────────────────────────────────

export function TipTapEditor({
  content,
  editable = false,
  onChange,
  onSave,
  className,
}: TipTapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [dokiOpen, setDokiOpen] = useState(false);
  const [dokiPrompt, setDokiPrompt] = useState('');
  const [dokiResponse, setDokiResponse] = useState('');
  const [dokiLoading, setDokiLoading] = useState(false);
  const [clauseRefs, setClauseRefs] = useState<string[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start typing your document content\u2026',
      }),
      CharacterCount,
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      Link.configure({ openOnClick: false }),
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
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

  // ── Doki AI handlers ──────────────────────────────────────────────────────────────────────

  const handleAskDoki = useCallback(() => {
    setDokiOpen(true);
  }, []);

  const handleDokiSubmit = useCallback(async () => {
    if (!editor || !dokiPrompt.trim()) return;
    setDokiLoading(true);
    setDokiResponse('');
    try {
      const res = await aiApi.documentGenerate({
        documentType: 'analysis',
        standards: ['iso_9001'],
        orgContext: `${dokiPrompt}\n\nDocument context:\n${editor.getText().slice(0, 3000)}`,
        sections: ['response'],
      });
      const data = res.data as Record<string, unknown>;
      setDokiResponse(
        (data.content as string) ??
        (data.text as string) ??
        JSON.stringify(data, null, 2)
      );
    } catch {
      setDokiResponse('Doki could not process your request. Please try again.');
    }
    setDokiLoading(false);
  }, [editor, dokiPrompt]);

  const handleInsertAtCursor = useCallback(() => {
    if (!editor || !dokiResponse) return;
    editor.chain().focus().insertContent(dokiResponse).run();
    setDokiOpen(false);
    setDokiResponse('');
    setDokiPrompt('');
  }, [editor, dokiResponse]);

  const handleReplaceSelection = useCallback(() => {
    if (!editor || !dokiResponse) return;
    editor.chain().focus().deleteSelection().insertContent(dokiResponse).run();
    setDokiOpen(false);
    setDokiResponse('');
    setDokiPrompt('');
  }, [editor, dokiResponse]);

  // ── Improve selected text ──────────────────────────────────────────────────────────────────

  const handleImprove = useCallback(async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (!selectedText.trim()) return;

    setDokiOpen(true);
    setDokiLoading(true);
    setDokiPrompt(`Improve this text for ISO compliance documents:\n"${selectedText}"`);
    setDokiResponse('');
    try {
      const res = await aiApi.documentGenerate({
        documentType: 'analysis',
        standards: ['iso_9001'],
        orgContext: `Rewrite and improve the following text for professional ISO compliance documentation. Return ONLY the improved text, no explanations:\n\n"${selectedText}"`,
        sections: ['response'],
      });
      const data = res.data as Record<string, unknown>;
      setDokiResponse(
        (data.content as string) ??
        (data.text as string) ??
        JSON.stringify(data, null, 2)
      );
    } catch {
      setDokiResponse('Could not improve text. Please try again.');
    }
    setDokiLoading(false);
  }, [editor]);

  // ── ISO Clause highlighting ────────────────────────────────────────────────────────────────

  const handleIsoClauses = useCallback(() => {
    if (!editor) return;
    const text = editor.getText();
    const pattern = /\b(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\b/g;
    const found: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const clause = match[1];
      const baseClause = clause.split('.').slice(0, 2).join('.');
      if (ISO_CLAUSE_MAP[baseClause] && !found.includes(clause)) {
        found.push(clause);
      }
    }
    setClauseRefs(found);
  }, [editor]);

  // ── Status bar info ──────────────────────────────────────────────────────────────────────

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
        <EditorRibbon
          editor={editor}
          readOnly={!editable}
          onAskDoki={handleAskDoki}
          onImprove={handleImprove}
          onIsoClauses={handleIsoClauses}
        />
      </div>

      {/* Document canvas */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--bg, #0a0a0a)' }}
      >
        <div className="mx-auto my-8" style={{ maxWidth: 816 }}>
          <div
            className="rounded"
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 40px rgba(0,0,0,0.4)',
              padding: '64px',
              minHeight: 600,
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
          background: '#0a0a0a',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <div className="flex items-center gap-3">
          <span>Words: {wordCount.toLocaleString()}</span>
          <span>&middot;</span>
          <span>Characters: {charCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          {clauseRefs.length > 0 && (
            <span>
              ISO refs: {clauseRefs.map((r) => {
                const base = r.split('.').slice(0, 2).join('.');
                const title = ISO_CLAUSE_MAP[base];
                return title ? `${r} (${title})` : r;
              }).join(', ')}
            </span>
          )}
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

      {/* Doki AI Sidebar */}
      {dokiOpen && (
        <div
          className="absolute top-0 right-0 h-full w-80 flex flex-col z-20 shadow-2xl"
          style={{
            background: 'var(--card-bg, #111111)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: 'rgba(99,102,241,0.15)' }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: '#818CF8' }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text, #fff)' }}>
                Doki AI
              </span>
            </div>
            <button
              onClick={() => { setDokiOpen(false); setDokiResponse(''); setDokiPrompt(''); }}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
              style={{ color: 'var(--muted, #6b7280)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <textarea
              value={dokiPrompt}
              onChange={(e) => setDokiPrompt(e.target.value)}
              placeholder="Ask Doki anything about this document..."
              rows={4}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text, #fff)',
              }}
            />
            <button
              onClick={handleDokiSubmit}
              disabled={dokiLoading || !dokiPrompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: '#c2fa69', color: '#0a0a0a' }}
            >
              {dokiLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Thinking&hellip;</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Ask Doki</>
              )}
            </button>

            {dokiResponse && (
              <div className="space-y-2">
                <div
                  className="rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'var(--text-secondary, #d1d5db)',
                  }}
                >
                  {dokiResponse}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleInsertAtCursor}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors"
                    style={{ background: 'rgba(194,250,105,0.12)', color: '#c2fa69' }}
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                    Insert at cursor
                  </button>
                  <button
                    onClick={handleReplaceSelection}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors"
                    style={{ background: 'rgba(194,250,105,0.12)', color: '#c2fa69' }}
                  >
                    <Replace className="h-3 w-3" />
                    Replace selection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ProseMirror / TipTap Styles */}
      <style jsx global>{`
        .tiptap-editor-content {
          outline: none;
          min-height: 400px;
          color: #0a0a0a;
          font-family: Georgia, 'Times New Roman', serif;
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
          font-family: var(--font-heading, Syne, sans-serif);
        }

        .tiptap-editor-content h2 {
          font-size: 20px;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          line-height: 1.35;
          color: #0a0a0a;
          font-family: var(--font-heading, Syne, sans-serif);
        }

        .tiptap-editor-content h3 {
          font-size: 16px;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
          color: #0a0a0a;
          font-family: var(--font-heading, Syne, sans-serif);
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
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
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

        /* Placeholder */
        .tiptap-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }

        /* Read-only cursor */
        .ProseMirror[contenteditable="false"] {
          cursor: default;
        }

        .ProseMirror[contenteditable="true"]:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
