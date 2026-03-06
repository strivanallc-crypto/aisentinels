'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  FileText,
  AlertCircle,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document, DocStatus } from '@/lib/types';
import {
  DOC_TYPE_LABELS,
  DOC_STATUS_LABELS,
  DOC_STATUS_VARIANT,
  ISO_STANDARD_LABELS,
} from '@/lib/types';
import type { IsoStandard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';

const STATUS_ICON: Record<DocStatus, React.ReactNode> = {
  draft: <FileText className="h-4 w-4" />,
  review: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  published: <CheckCircle className="h-4 w-4" />,
  archived: <XCircle className="h-4 w-4" />,
};

function extractText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const doc = body as { type?: string; content?: unknown[] };
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return JSON.stringify(body, null, 2);

  const lines: string[] = [];
  for (const node of doc.content) {
    const n = node as { type?: string; content?: { type?: string; text?: string }[] };
    if (n.type === 'paragraph' && Array.isArray(n.content)) {
      lines.push(n.content.map((c) => c.text ?? '').join(''));
    } else if (n.type === 'heading' && Array.isArray(n.content)) {
      lines.push(n.content.map((c) => c.text ?? '').join(''));
    } else {
      lines.push('');
    }
  }
  return lines.join('\n');
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deciding, setDeciding] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsApi.get(id);
      setDoc(res.data as Document);
    } catch {
      setError('Document not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
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

  const handleDecide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!doc) return;
    setDeciding(decision);
    try {
      await documentsApi.decide(doc.id, decision);
      await load();
    } catch {
      setError(`Failed to ${decision.toLowerCase()} document.`);
    } finally {
      setDeciding(null);
    }
  };

  const content = doc ? extractText(doc.bodyJsonb) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--content-text-dim)' }} />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/document-studio')} className="mb-4 flex items-center gap-1 text-sm" style={{ color: 'var(--content-text-muted)' }}>
          <ChevronLeft className="h-4 w-4" /> Back to Documents
        </button>
        <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'Document not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/document-studio')}
        className="flex items-center gap-1 text-sm self-start transition-colors"
        style={{ color: 'var(--content-text-muted)' }}
      >
        <ChevronLeft className="h-4 w-4" /> Back to Documents
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 flex-shrink-0 mt-0.5">
            {STATUS_ICON[doc.status]}
          </div>
          <div>
            <h1 className="text-xl font-bold">{doc.title}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant={DOC_STATUS_VARIANT[doc.status]}>
                {DOC_STATUS_LABELS[doc.status]}
              </Badge>
              <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                {DOC_TYPE_LABELS[doc.docType]}
              </span>
              <span className="text-xs rounded bg-white/10 px-1.5 py-0.5 font-mono" style={{ color: 'var(--content-text-dim)' }}>
                v{doc.version}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {doc.status === 'draft' && (
            <Button onClick={handleSubmit} disabled={submitting} size="sm">
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </Button>
          )}
          {doc.status === 'review' && (
            <>
              <Button
                onClick={() => handleDecide('APPROVED')}
                disabled={deciding !== null}
                size="sm"
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                {deciding === 'APPROVED' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDecide('REJECTED')}
                disabled={deciding !== null}
                size="sm"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                {deciding === 'REJECTED' ? 'Rejecting…' : 'Reject'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metadata panel + Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Content */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--content-border)', background: 'var(--content-bg)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              Document Content
            </span>
            {content && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: 'var(--content-text-muted)' }}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="p-6">
            {content ? (
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed" style={{ color: 'var(--content-text)' }}>
                {content}
              </pre>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <SentinelAvatar sentinelId="doki" size={48} className="opacity-50" />
                <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
                  No content yet. Edit this document or use Doki to generate content.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar metadata */}
        <div className="flex flex-col gap-4">
          {/* Standards */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              Standards
            </h3>
            {doc.standards.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {doc.standards.map((s) => (
                  <Badge key={s} variant="default">
                    {ISO_STANDARD_LABELS[s as IsoStandard] ?? s}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>No standards assigned</p>
            )}
          </div>

          {/* Clause References */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              Clause References
            </h3>
            {doc.clauseRefs.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {doc.clauseRefs.map((ref) => (
                  <Badge key={ref} variant="outline" className="text-[10px]">{ref}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>No clauses mapped</p>
            )}
          </div>

          {/* Timeline */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
              Timeline
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Created</span>
                <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--content-text-muted)' }}>Updated</span>
                <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
              </div>
              {doc.approvedAt && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--content-text-muted)' }}>Approved</span>
                  <span>{new Date(doc.approvedAt).toLocaleDateString()}</span>
                </div>
              )}
              {doc.effectiveDate && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--content-text-muted)' }}>Effective</span>
                  <span>{new Date(doc.effectiveDate).toLocaleDateString()}</span>
                </div>
              )}
              {doc.reviewDate && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--content-text-muted)' }}>Next Review</span>
                  <span>{new Date(doc.reviewDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Integrity */}
          {doc.sha256Hash && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
            >
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                Integrity Hash
              </h3>
              <p className="break-all font-mono text-[10px]" style={{ color: 'var(--content-text-dim)' }}>
                {doc.sha256Hash}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
