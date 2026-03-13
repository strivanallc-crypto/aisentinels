'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  AlertCircle,
  Send,
  Loader2,
  ChevronDown,
  Save,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  ArrowDownToLine,
} from 'lucide-react';
import { documentsApi, aiApi } from '@/lib/api';
import type { Document, DocType, DocStatus, IsoStandard } from '@/lib/types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/lib/types';
import { TipTapEditor } from '@/components/document-studio/tiptap-editor';
import type { TipTapEditorHandle } from '@/components/document-studio/tiptap-editor';

/* ── Constants ──────────────────────────────────────────────── */

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

const STANDARDS: { value: IsoStandard; label: string; color: string }[] = [
  { value: 'iso_9001', label: 'ISO 9001', color: '#3B82F6' },
  { value: 'iso_14001', label: 'ISO 14001', color: '#22C55E' },
  { value: 'iso_45001', label: 'ISO 45001', color: '#F59E0B' },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  draft:     { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  review:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approved:  { color: '#c2fa69', bg: 'rgba(194,250,105,0.12)' },
  published: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  archived:  { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const ANNEX_SL_CLAUSES: { clause: string; title: string }[] = [
  { clause: '4.1', title: 'Context' },
  { clause: '4.2', title: 'Interested parties' },
  { clause: '4.3', title: 'Scope' },
  { clause: '5.1', title: 'Leadership' },
  { clause: '5.2', title: 'Policy' },
  { clause: '5.3', title: 'Roles' },
  { clause: '6.1', title: 'Risks' },
  { clause: '6.2', title: 'Objectives' },
  { clause: '7.1', title: 'Resources' },
  { clause: '7.2', title: 'Competence' },
  { clause: '7.3', title: 'Awareness' },
  { clause: '7.4', title: 'Communication' },
  { clause: '7.5', title: 'Documented info' },
  { clause: '8.1', title: 'Operations' },
  { clause: '9.1', title: 'Monitoring' },
  { clause: '9.2', title: 'Internal audit' },
  { clause: '9.3', title: 'Mgmt review' },
  { clause: '10.2', title: 'CAPA' },
  { clause: '10.3', title: 'Improvement' },
];

/* ── AI Chat Message ── */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/* ── Page ──────────────────────────────────────────────────── */

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Document header state */
  const [editTitle, setEditTitle] = useState('');
  const [editDocType, setEditDocType] = useState<DocType>('procedure');
  const [editStandards, setEditStandards] = useState<IsoStandard[]>([]);

  /* Saving state */
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* Clause sidebar */
  const [clauseOpen, setClauseOpen] = useState(true);

  /* Doki AI co-pilot */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [dokiPrompt, setDokiPrompt] = useState('');
  const [dokiLoading, setDokiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* Editor ref for inserting content */
  const editorRef = useRef<TipTapEditorHandle>(null);

  /* ── Load document ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsApi.get(id);
      const d = res.data as Document;
      setDoc(d);
      setEditTitle(d.title);
      setEditDocType(d.docType);
      setEditStandards((d.standards ?? []) as IsoStandard[]);
    } catch {
      setError('Document not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* Scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* ── Handlers ── */

  const handleTitleBlur = async () => {
    if (!doc || editTitle === doc.title) return;
    try {
      await documentsApi.update(doc.id, { title: editTitle });
      setDoc((prev) => prev ? { ...prev, title: editTitle } : prev);
    } catch { /* silent */ }
  };

  const handleDocTypeChange = async (newType: DocType) => {
    setEditDocType(newType);
    if (!doc) return;
    try {
      await documentsApi.update(doc.id, { docType: newType });
      setDoc((prev) => prev ? { ...prev, docType: newType } : prev);
    } catch { /* silent */ }
  };

  const toggleStandard = async (std: IsoStandard) => {
    if (!doc) return;
    const next = editStandards.includes(std)
      ? editStandards.filter((s) => s !== std)
      : [...editStandards, std];
    setEditStandards(next);
    try {
      await documentsApi.update(doc.id, { standards: next });
      setDoc((prev) => prev ? { ...prev, standards: next } : prev);
    } catch { /* silent */ }
  };

  const handleSaveDraft = async () => {
    if (!doc) return;
    setSavingDraft(true);
    try {
      await documentsApi.update(doc.id, { status: 'draft' });
      setDoc((prev) => prev ? { ...prev, status: 'draft' as DocStatus } : prev);
    } catch { /* silent */ }
    finally { setSavingDraft(false); }
  };

  const handleSubmitForApproval = async () => {
    if (!doc) return;
    setSubmitting(true);
    try {
      await documentsApi.submit(doc.id, []);
      await load();
    } catch {
      setError('Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Doki AI ── */
  const handleDokiSubmit = async () => {
    if (!dokiPrompt.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: dokiPrompt };
    setChatMessages((prev) => [...prev, userMsg]);
    setDokiPrompt('');
    setDokiLoading(true);

    try {
      const ed = editorRef.current?.getEditor();
      const context = ed?.getText()?.slice(0, 500) ?? '';

      const res = await aiApi.documentGenerate({
        documentType: editDocType,
        standards: editStandards.length > 0 ? editStandards : ['iso_9001'],
        orgContext: `${userMsg.content}\n\nDocument context:\n${context}`,
        sections: ['response'],
      });
      const data = res.data as Record<string, unknown>;
      const response =
        (data.content as string) ??
        (data.text as string) ??
        JSON.stringify(data, null, 2);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Doki is processing... this may take up to 40 seconds. Please try again.',
        },
      ]);
    }
    setDokiLoading(false);
  };

  const handleInsertAtCursor = (text: string) => {
    const ed = editorRef.current?.getEditor();
    if (!ed) return;
    const pos = ed.state.selection.anchor;
    ed.commands.insertContentAt(pos, text);
  };

  const handleClauseClick = (clause: string) => {
    const ed = editorRef.current?.getEditor();
    if (!ed) return;
    const stdLabel = editStandards[0]
      ? editStandards[0].replace('iso_', 'ISO ').replace('_', ' ')
      : 'ISO 9001';
    const refText = `[${stdLabel}:${clause}]`;
    const pos = ed.state.selection.anchor;
    ed.commands.insertContentAt(pos, refText);
  };

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#6366F1' }} />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/document-studio')}
          className="mb-4 flex items-center gap-1 text-sm"
          style={{ color: 'var(--content-text-muted)' }}
        >
          <ChevronLeft className="h-4 w-4" /> Back to Documents
        </button>
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
          }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'Document not found'}
        </div>
      </div>
    );
  }

  const sts = STATUS_STYLES[doc.status] ?? STATUS_STYLES.draft;
  const isEditable = doc.status === 'draft';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" style={{ color: 'var(--content-text)' }}>
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => router.push('/document-studio')}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: 'var(--content-text-muted)' }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Documents
        </button>
        <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>/</span>
        <span className="text-xs font-medium truncate max-w-[300px]">{doc.title}</span>
      </div>

      {/* ── Document Header ── */}
      <div
        className="flex items-center justify-between gap-4 px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Editable title */}
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={!isEditable}
            className="text-xl font-bold font-heading bg-transparent border-none outline-none flex-1 min-w-0 disabled:cursor-default"
            style={{ color: 'var(--text)' }}
          />

          {/* Type selector */}
          <div className="relative flex-shrink-0">
            <select
              value={editDocType}
              onChange={(e) => handleDocTypeChange(e.target.value as DocType)}
              disabled={!isEditable}
              className="appearance-none rounded-lg border bg-transparent px-3 py-1.5 pr-7 text-xs font-medium outline-none cursor-pointer disabled:cursor-default disabled:opacity-60"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text)' }}
            >
              {DOC_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--content-text-dim)' }} />
          </div>

          {/* Standard pills */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {STANDARDS.map((s) => {
              const active = editStandards.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => toggleStandard(s.value)}
                  disabled={!isEditable}
                  className="rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all disabled:cursor-default"
                  style={{
                    background: active ? `${s.color}20` : 'rgba(255,255,255,0.04)',
                    color: active ? s.color : 'var(--content-text-dim)',
                    border: `1px solid ${active ? `${s.color}40` : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Status badge */}
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
            style={{ color: sts.color, background: sts.bg }}
          >
            {DOC_STATUS_LABELS[doc.status] ?? doc.status}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditable && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
              >
                <Save className="h-3.5 w-3.5" />
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleSubmitForApproval}
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: '#c2fa69', color: '#0a0a0a' }}
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main content: 3-panel layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Doki AI Co-Pilot (30%) ── */}
        <div
          className="w-[30%] min-w-[280px] max-w-[400px] flex flex-col flex-shrink-0"
          style={{
            background: '#0c0f1a',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{
              background: 'rgba(99,102,241,0.08)',
              borderBottom: '1px solid rgba(99,102,241,0.15)',
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'rgba(99,102,241,0.2)' }}
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: '#818CF8' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#c7d2fe' }}>
              Doki AI
            </span>
            {editStandards.length > 0 && (
              <span className="ml-auto text-[10px] font-medium rounded-md px-1.5 py-0.5" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                {editStandards.map((s) => s.replace('iso_', '').replace('_', '')).join(' / ')}
              </span>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-3" style={{ color: 'rgba(99,102,241,0.3)' }} />
                <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
                  Ask Doki to help write, improve, or analyze your document content.
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className="rounded-lg px-3 py-2 text-sm leading-relaxed max-w-[90%] whitespace-pre-wrap"
                  style={{
                    background: msg.role === 'user'
                      ? 'rgba(99,102,241,0.15)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    color: msg.role === 'user' ? '#c7d2fe' : 'var(--text-secondary, #d1d5db)',
                  }}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleInsertAtCursor(msg.content)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
                    style={{ background: 'rgba(194,250,105,0.1)', color: '#c2fa69' }}
                  >
                    <ArrowDownToLine className="h-2.5 w-2.5" />
                    Insert at cursor
                  </button>
                )}
              </div>
            ))}
            {dokiLoading && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#818CF8' }} />
                <span className="text-xs" style={{ color: '#a5b4fc' }}>Doki is thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <textarea
              value={dokiPrompt}
              onChange={(e) => setDokiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleDokiSubmit();
                }
              }}
              placeholder="Ask Doki..."
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none mb-2"
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
                <><Loader2 className="h-4 w-4 animate-spin" /> Thinking...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Ask Doki</>
              )}
            </button>
          </div>
        </div>

        {/* ── Center: Editor canvas (flexible) ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TipTapEditor
            ref={editorRef}
            content={doc.bodyJsonb as Record<string, unknown> | null | undefined}
            editable={isEditable}
            onSave={async (json) => {
              await documentsApi.update(doc.id, { bodyJsonb: json });
            }}
          />
        </div>

        {/* ── Right: ISO Clause sidebar (collapsible) ── */}
        <div
          className={`flex flex-col flex-shrink-0 transition-all duration-300 ${clauseOpen ? 'w-[220px]' : 'w-[40px]'}`}
          style={{
            background: '#0c0f1a',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Toggle button */}
          <button
            onClick={() => setClauseOpen((v) => !v)}
            className="flex items-center justify-center py-3 transition-colors"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--content-text-muted)' }}
            title={clauseOpen ? 'Collapse clauses' : 'Expand clauses'}
          >
            {clauseOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>

          {clauseOpen && (
            <>
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Clause References
                </p>
              </div>

              {/* Standard filter pills */}
              <div className="flex gap-1 px-3 pb-2 flex-wrap">
                {editStandards.map((s) => {
                  const std = STANDARDS.find((x) => x.value === s);
                  return (
                    <span
                      key={s}
                      className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{
                        background: `${std?.color ?? '#6366F1'}20`,
                        color: std?.color ?? '#818CF8',
                      }}
                    >
                      {s.replace('iso_', 'ISO ')}
                    </span>
                  );
                })}
                {editStandards.length === 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>
                    Select standards above
                  </span>
                )}
              </div>

              {/* Clause chips */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <div className="flex flex-wrap gap-1">
                  {ANNEX_SL_CLAUSES.map((c) => (
                    <button
                      key={c.clause}
                      onClick={() => handleClauseClick(c.clause)}
                      disabled={!isEditable}
                      className="rounded-md px-2 py-1 text-[10px] font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-default text-left"
                      style={{
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.12)',
                        color: '#a5b4fc',
                      }}
                      title={`${c.clause} — ${c.title}`}
                    >
                      <span className="font-semibold">{c.clause}</span>
                      <br />
                      <span style={{ color: 'rgba(165,180,252,0.6)', fontSize: '9px' }}>{c.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
