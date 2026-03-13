'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Editor } from '@tiptap/react';
import {
  ChevronLeft,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Save,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Undo2,
  Clock,
  ChevronDown,
  FileDown,
} from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocType, DocStatus } from '@/lib/types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '@/lib/types';
import { TipTapEditor } from '@/components/document-studio/tiptap-editor';
import { DokiCoPilot } from '@/components/document-studio/doki-copilot';
import { ClauseSidebar } from '@/components/document-studio/clause-sidebar';
import { GapAnalysisPanel } from '@/components/document-studio/gap-analysis-panel';
import { VersionHistoryPanel } from '@/components/document-studio/version-history-panel';

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS) as [DocType, string][];

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  draft: { text: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  review: { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  approved: { text: '#c2fa69', bg: 'rgba(194,250,105,0.12)' },
  published: { text: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  archived: { text: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

/* ── DOCX Export — TipTap JSON → docx.js ─────────────────────────────── */

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

async function exportToDocx(title: string, json: Record<string, unknown> | null | undefined) {
  const { Document: DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } =
    await import('docx');

  const content = (json as { content?: TipTapNode[] } | null)?.content ?? [];

  /** Convert TipTap marks to TextRun options */
  const toTextRun = (node: TipTapNode) => {
    const text = node.text ?? '';
    const marks = node.marks ?? [];
    const opts: Record<string, unknown> = { text };
    for (const m of marks) {
      if (m.type === 'bold') opts.bold = true;
      if (m.type === 'italic') opts.italics = true;
      if (m.type === 'underline') opts.underline = {};
      if (m.type === 'strike') opts.strike = true;
    }
    return new TextRun(opts as ConstructorParameters<typeof TextRun>[0]);
  };

  /** Collect inline TextRuns from a node's content */
  const inlineRuns = (node: TipTapNode): InstanceType<typeof TextRun>[] => {
    if (!node.content) return [new TextRun('')];
    return node.content.map((child) => {
      if (child.type === 'text') return toTextRun(child);
      if (child.type === 'hardBreak') return new TextRun({ break: 1 });
      return new TextRun(child.text ?? '');
    });
  };

  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  const processList = (items: TipTapNode[], ordered: boolean) => {
    items.forEach((item, idx) => {
      if (item.type !== 'listItem') return;
      const inner = item.content ?? [];
      for (const p of inner) {
        if (p.type === 'paragraph') {
          const runs = inlineRuns(p);
          if (ordered) {
            // Prefix with number for ordered lists
            runs.unshift(new TextRun({ text: `${idx + 1}. ` }));
            paragraphs.push(new Paragraph({ children: runs, indent: { left: 720 } }));
          } else {
            paragraphs.push(new Paragraph({ children: runs, bullet: { level: 0 } }));
          }
        } else if (p.type === 'bulletList') {
          processList(p.content ?? [], false);
        } else if (p.type === 'orderedList') {
          processList(p.content ?? [], true);
        }
      }
    });
  };

  for (const node of content) {
    switch (node.type) {
      case 'heading': {
        const level = (node.attrs?.level ?? 1) as number;
        const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };
        paragraphs.push(
          new Paragraph({
            children: inlineRuns(node),
            heading: headingMap[level] ?? HeadingLevel.HEADING_1,
          })
        );
        break;
      }
      case 'paragraph':
        paragraphs.push(new Paragraph({ children: inlineRuns(node) }));
        break;
      case 'bulletList':
        processList(node.content ?? [], false);
        break;
      case 'orderedList':
        processList(node.content ?? [], true);
        break;
      case 'blockquote': {
        const inner = node.content ?? [];
        for (const child of inner) {
          if (child.type === 'paragraph') {
            paragraphs.push(
              new Paragraph({
                children: inlineRuns(child),
                indent: { left: 720 },
                style: 'IntenseQuote',
              })
            );
          }
        }
        break;
      }
      case 'horizontalRule':
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: '―'.repeat(50) })],
            alignment: AlignmentType.CENTER,
          })
        );
        break;
      default:
        // TODO: Handle tables, images, and other complex nodes in a future iteration
        if (node.content) {
          paragraphs.push(new Paragraph({ children: inlineRuns(node) }));
        }
        break;
    }
  }

  // Build document
  const docxDoc = new DocxDocument({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  // Generate blob and trigger download
  const blob = await Packer.toBlob(docxDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'document'}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Main Page Component ──────────────────────────────────────────────── */

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deciding, setDeciding] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [dokiOpen, setDokiOpen] = useState(true);
  const [gapOpen, setGapOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Rejection notes
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  // G-DS-3: History + Export state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Editable header fields
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocType>('procedure');
  const [standards, setStandards] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsApi.get(id);
      const d = res.data as Document;
      setDoc(d);
      setTitle(d.title);
      setDocType(d.docType);
      setStandards(d.standards ?? []);
    } catch {
      setError('Document not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-save debounce ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAutoSave = useCallback(async (json: Record<string, unknown>) => {
    if (!doc) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await documentsApi.update(doc.id, { bodyJsonb: json });
        setLastSaved(new Date());
      } catch { /* silent */ }
      finally { setSaving(false); }
    }, 2000);
  }, [doc]);

  const handleSaveDraft = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await documentsApi.update(doc.id, { title, docType, standards });
      setLastSaved(new Date());
      // Also save editor content if available
      if (editorInstance) {
        const json = editorInstance.getJSON() as Record<string, unknown>;
        await documentsApi.update(doc.id, { bodyJsonb: json });
      }
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!doc) return;
    setSubmitting(true);
    try {
      // Save first
      await handleSaveDraft();
      await documentsApi.submit(doc.id, []);
      await load();
    } catch {
      setError('Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecide = async (decision: 'APPROVED' | 'REJECTED', comments?: string) => {
    if (!doc) return;
    setDeciding(decision);
    try {
      await documentsApi.decide(doc.id, decision, comments);
      setShowRejectInput(false);
      setRejectNotes('');
      await load();
    } catch {
      setError(`Failed to ${decision.toLowerCase()} document.`);
    } finally {
      setDeciding(null);
    }
  };

  const handleWithdraw = async () => {
    if (!doc) return;
    setWithdrawing(true);
    try {
      await documentsApi.update(doc.id, { status: 'draft' as DocStatus });
      await load();
    } catch {
      setError('Failed to withdraw document.');
    } finally {
      setWithdrawing(false);
    }
  };

  const toggleStandard = (std: string) => {
    setStandards((prev) =>
      prev.includes(std) ? prev.filter((s) => s !== std) : [...prev, std]
    );
  };

  // G-DS-3: Export handlers
  const handleExportPDF = () => {
    setExportOpen(false);
    window.print();
  };

  const handleExportDOCX = async () => {
    if (!doc) return;
    setExportOpen(false);
    try {
      const json = editorInstance
        ? (editorInstance.getJSON() as Record<string, unknown>)
        : (doc.bodyJsonb as Record<string, unknown> | null | undefined);
      await exportToDocx(doc.title, json);
    } catch {
      setError('Failed to export DOCX.');
    }
  };

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

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
        <button onClick={() => router.push('/document-studio')} className="mb-4 flex items-center gap-1 text-sm" style={{ color: 'var(--content-text-muted)' }}>
          <ChevronLeft className="h-4 w-4" /> Back to Documents
        </button>
        <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'Document not found'}
        </div>
      </div>
    );
  }

  const isEditable = doc.status === 'draft';
  const sc = STATUS_COLORS[doc.status] ?? STATUS_COLORS.draft;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" style={{ color: 'var(--content-text)' }}>
      {/* Document Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Back */}
          <button
            onClick={() => router.push('/document-studio')}
            className="flex items-center gap-1 text-sm flex-shrink-0 transition-colors hover:text-white"
            style={{ color: 'var(--content-text-muted)' }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Doki toggle */}
          <button
            onClick={() => setDokiOpen((o) => !o)}
            className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/10"
            title={dokiOpen ? 'Hide Doki' : 'Show Doki'}
          >
            {dokiOpen ? (
              <PanelLeftClose className="h-4 w-4" style={{ color: '#6366F1' }} />
            ) : (
              <PanelLeftOpen className="h-4 w-4" style={{ color: '#6366F1' }} />
            )}
          </button>

          {/* Title */}
          {isEditable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-bold bg-transparent outline-none border-none flex-1 min-w-0 truncate"
              style={{ color: 'var(--text)' }}
              placeholder="Untitled Document"
            />
          ) : (
            <h1 className="text-lg font-bold truncate flex-1 min-w-0">{doc.title}</h1>
          )}

          {/* Type selector */}
          {isEditable ? (
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="rounded-lg border bg-transparent px-2 py-1 text-xs outline-none flex-shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--content-surface)' }}
            >
              {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : (
            <span className="text-xs flex-shrink-0 rounded-lg px-2 py-0.5" style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8' }}>
              {DOC_TYPE_LABELS[doc.docType]}
            </span>
          )}

          {/* Standards toggles */}
          <div className="flex gap-1 flex-shrink-0">
            {(['iso_9001', 'iso_14001', 'iso_45001'] as const).map((std) => {
              const active = standards.includes(std);
              const colors: Record<string, { on: string; off: string }> = {
                iso_9001: { on: '#3B82F6', off: 'rgba(59,130,246,0.15)' },
                iso_14001: { on: '#22C55E', off: 'rgba(34,197,94,0.15)' },
                iso_45001: { on: '#F59E0B', off: 'rgba(245,158,11,0.15)' },
              };
              const c = colors[std];
              return (
                <button
                  key={std}
                  onClick={() => isEditable && toggleStandard(std)}
                  disabled={!isEditable}
                  className="rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all"
                  style={{
                    background: active ? `${c.on}22` : 'transparent',
                    color: active ? c.on : 'var(--content-text-dim)',
                    border: `1px solid ${active ? c.on : 'var(--border)'}`,
                    opacity: isEditable ? 1 : 0.7,
                    cursor: isEditable ? 'pointer' : 'default',
                  }}
                >
                  {std.replace('iso_', '').toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Status badge */}
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
            style={{ color: sc.text, background: sc.bg }}
          >
            {DOC_STATUS_LABELS[doc.status] ?? doc.status}
          </span>

          {/* Version */}
          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--content-text-dim)' }}>
            v{doc.version}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {/* Save indicator */}
          {saving && (
            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--content-text-dim)' }}>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {!saving && lastSaved && (
            <span className="text-[11px]" style={{ color: 'var(--content-text-dim)' }}>
              Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* G-DS-3: History button — visible all statuses */}
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border"
            style={{
              borderColor: historyOpen ? '#6366F1' : 'var(--border)',
              color: historyOpen ? '#6366F1' : 'var(--text)',
              background: historyOpen ? 'rgba(99,102,241,0.08)' : 'transparent',
            }}
          >
            <Clock className="h-3.5 w-3.5" />
            History
          </button>

          {/* Analyze Compliance button — visible for drafts */}
          {isEditable && (
            <button
              onClick={() => setGapOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border"
              style={{
                borderColor: gapOpen ? '#6366F1' : 'var(--border)',
                color: gapOpen ? '#6366F1' : 'var(--text)',
                background: gapOpen ? 'rgba(99,102,241,0.08)' : 'transparent',
              }}
            >
              <Search className="h-3.5 w-3.5" />
              Analyze Compliance
            </button>
          )}

          {/* G-DS-3: Export dropdown — visible all statuses */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border"
              style={{
                borderColor: exportOpen ? '#6366F1' : 'var(--border)',
                color: exportOpen ? '#6366F1' : 'var(--text)',
                background: exportOpen ? 'rgba(99,102,241,0.08)' : 'transparent',
              }}
            >
              <FileDown className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>

            {exportOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border py-1 shadow-lg"
                style={{
                  background: 'var(--content-surface)',
                  borderColor: 'var(--content-border)',
                }}
              >
                <button
                  onClick={handleExportPDF}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5"
                  style={{ color: 'var(--content-text)' }}
                >
                  <FileDown className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />
                  Export as PDF
                </button>
                <button
                  onClick={handleExportDOCX}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5"
                  style={{ color: 'var(--content-text)' }}
                >
                  <FileDown className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} />
                  Export as DOCX
                </button>
              </div>
            )}
          </div>

          {isEditable && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <Save className="h-3.5 w-3.5" /> Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: '#c2fa69', color: '#0a0f1a' }}
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </>
          )}

          {doc.status === 'review' && (
            <>
              {!showRejectInput ? (
                <>
                  <button
                    onClick={() => handleDecide('APPROVED')}
                    disabled={deciding !== null}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: '#c2fa69', color: '#0a0f1a' }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {deciding === 'APPROVED' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={deciding !== null}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border"
                    style={{ borderColor: 'var(--border)', color: '#f87171' }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Rejection notes..."
                    className="rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none w-48"
                    style={{ borderColor: 'rgba(248,113,113,0.3)', color: 'var(--text)' }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleDecide('REJECTED', rejectNotes || undefined)}
                    disabled={deciding !== null}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {deciding === 'REJECTED' ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectNotes(''); }}
                    className="text-xs transition-colors"
                    style={{ color: 'var(--content-text-muted)' }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {doc.status === 'review' && (
        <div
          className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}
        >
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#F59E0B' }} />
            <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
              Awaiting Approval
            </span>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors border"
            style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#F59E0B' }}
          >
            <Undo2 className="h-3 w-3" />
            {withdrawing ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      )}

      {doc.status === 'approved' && (
        <div
          className="flex items-center px-5 py-2.5 flex-shrink-0"
          style={{ background: 'rgba(194,250,105,0.06)', borderBottom: '1px solid rgba(194,250,105,0.12)' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5" style={{ color: '#c2fa69' }} />
            <span className="text-xs font-semibold" style={{ color: '#c2fa69' }}>
              Approved
              {doc.approvedAt && (
                <> on {new Date(doc.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Three-zone layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Doki AI Co-Pilot */}
        {dokiOpen && (
          <div
            className="w-[30%] min-w-[280px] max-w-[400px] border-r overflow-y-auto flex-shrink-0"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <DokiCoPilot
              editor={editorInstance}
              standards={standards}
              documentType={docType}
            />
          </div>
        )}

        {/* Center: Gap Analysis + TipTap Editor */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <GapAnalysisPanel
            open={gapOpen}
            onClose={() => setGapOpen(false)}
            editor={editorInstance}
            standards={standards}
            docType={docType}
          />
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#0a0f1a' }}>
            <TipTapEditor
              content={doc.bodyJsonb as Record<string, unknown> | null | undefined}
              editable={isEditable}
              onSave={handleAutoSave}
              onEditorReady={setEditorInstance}
            />
          </div>
        </div>

        {/* Right: ISO Clause Sidebar */}
        <ClauseSidebar
          editor={editorInstance}
          standards={standards}
          createdAt={doc.createdAt}
          updatedAt={doc.updatedAt}
        />

        {/* G-DS-3: Version History Panel overlay */}
        {historyOpen && (
          <VersionHistoryPanel
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            doc={doc}
          />
        )}
      </div>
    </div>
  );
}
