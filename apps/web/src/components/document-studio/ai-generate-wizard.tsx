'use client';

import { useState } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { aiApi, documentsApi } from '@/lib/api';
import type { DocType, IsoStandard } from '@/lib/types';
import { DOC_TYPE_LABELS, ISO_STANDARD_LABELS } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type Step = 'config' | 'sections' | 'generating' | 'preview';

const STANDARDS: { value: IsoStandard; label: string; color: string }[] = [
  { value: 'iso_9001', label: 'ISO 9001', color: '#3B82F6' },
  { value: 'iso_14001', label: 'ISO 14001', color: '#22C55E' },
  { value: 'iso_45001', label: 'ISO 45001', color: '#F59E0B' },
];

const DEFAULT_SECTIONS: Record<string, string[]> = {
  policy: ['Purpose', 'Scope', 'Policy Statement', 'Responsibilities', 'Review'],
  procedure: ['Purpose', 'Scope', 'Definitions', 'Responsibilities', 'Procedure Steps', 'Records', 'References'],
  work_instruction: ['Purpose', 'Safety Precautions', 'Equipment & Materials', 'Step-by-Step Instructions', 'Verification'],
  manual: ['Introduction', 'Scope', 'Normative References', 'Terms & Definitions', 'Context of the Organisation', 'Leadership', 'Planning', 'Support', 'Operation', 'Performance Evaluation', 'Improvement'],
  plan: ['Objective', 'Scope', 'Activities', 'Responsibilities', 'Timeline', 'Resources', 'Monitoring'],
  form: ['Header / Form ID', 'Fields', 'Instructions', 'Approval Section'],
  record: ['Record Details', 'Data Fields', 'Retention Information'],
  specification: ['Scope', 'Requirements', 'Test Methods', 'Acceptance Criteria'],
  external: ['Document Reference', 'Applicability', 'Key Requirements'],
};

export function AiGenerateWizard({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>('config');
  const [docType, setDocType] = useState<DocType>('procedure');
  const [standards, setStandards] = useState<IsoStandard[]>(['iso_9001']);
  const [orgContext, setOrgContext] = useState('');
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS.procedure);
  const [customSection, setCustomSection] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [clauseRefs, setClauseRefs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep('config');
    setDocType('procedure');
    setStandards(['iso_9001']);
    setOrgContext('');
    setTitle('');
    setSections(DEFAULT_SECTIONS.procedure);
    setCustomSection('');
    setGeneratedContent('');
    setClauseRefs([]);
    setError(null);
    setSaving(false);
    setCopied(false);
  };

  const toggleStandard = (s: IsoStandard) => {
    setStandards((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleDocTypeChange = (type: DocType) => {
    setDocType(type);
    setSections(DEFAULT_SECTIONS[type] ?? ['Introduction', 'Content', 'References']);
  };

  const addSection = () => {
    const s = customSection.trim();
    if (s && !sections.includes(s)) {
      setSections((prev) => [...prev, s]);
      setCustomSection('');
    }
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const handleGenerate = async () => {
    setStep('generating');
    setError(null);
    try {
      const res = await aiApi.documentGenerate({
        documentType: `${DOC_TYPE_LABELS[docType]}${title ? `: ${title}` : ''}`,
        standards,
        orgContext: orgContext || 'Generic organisation seeking ISO compliance',
        sections,
      });
      const data = res.data as { content: string; clauseRefs: string[] };
      setGeneratedContent(data.content);
      setClauseRefs(data.clauseRefs ?? []);
      setStep('preview');
    } catch {
      setError('Doki could not generate the document. Please try again.');
      setStep('sections');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await documentsApi.create({
        title: title || `${DOC_TYPE_LABELS[docType]} — AI Generated`,
        docType,
        content: generatedContent,
        standards,
        clauseRefs,
      });
      onCreated();
      onOpenChange(false);
      reset();
    } catch {
      setError('Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canProceedFromConfig = standards.length > 0;
  const canProceedFromSections = sections.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title=""
      className="max-w-2xl"
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-3 -mt-2">
        <SentinelAvatar sentinelId="doki" size={36} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
            Doki — AI Document Generator
          </h2>
          <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
            {step === 'config' && 'Configure your document'}
            {step === 'sections' && 'Customise sections'}
            {step === 'generating' && 'Generating with Gemini 2.5 Pro…'}
            {step === 'preview' && 'Review generated document'}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-1">
        {(['config', 'sections', 'generating', 'preview'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`h-2 flex-1 rounded-full transition-colors ${
                s === step ? 'w-12 bg-indigo-500' :
                (['config', 'sections', 'generating', 'preview'].indexOf(s) < ['config', 'sections', 'generating', 'preview'].indexOf(step))
                  ? 'w-12 bg-white/10' : 'w-12 bg-white/5'
              }`}
            />
            {i < 3 && <div className="w-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border bg-red-500/10 border-red-500/20 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Step: Config ── */}
      {step === 'config' && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Document Title <span className="text-xs font-normal" style={{ color: 'var(--content-text-dim)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Supplier Qualification Procedure"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>Document Type</label>
            <select
              value={docType}
              onChange={(e) => handleDocTypeChange(e.target.value as DocType)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            >
              {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>ISO Standards</label>
            <div className="flex gap-2">
              {STANDARDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleStandard(s.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    standards.includes(s.value)
                      ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                  style={!standards.includes(s.value) ? { color: 'var(--content-text-dim)' } : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Organisation Context <span className="text-xs font-normal" style={{ color: 'var(--content-text-dim)' }}>(optional)</span>
            </label>
            <textarea
              rows={3}
              value={orgContext}
              onChange={(e) => setOrgContext(e.target.value)}
              placeholder="Describe your organisation, industry, size, key processes…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep('sections')} disabled={!canProceedFromConfig}>
              Customise Sections
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Sections ── */}
      {step === 'sections' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
            Drag to reorder, remove unwanted sections, or add custom ones.
          </p>

          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
            {sections.map((sec, idx) => (
              <div
                key={`${sec}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <span className="text-xs font-mono w-5 text-right" style={{ color: 'var(--content-text-dim)' }}>{idx + 1}</span>
                <span className="flex-1 font-medium" style={{ color: 'var(--content-text)' }}>{sec}</span>
                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  className="hover:opacity-80 text-xs"
                  style={{ color: 'var(--content-text-dim)' }}
                  disabled={idx === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  className="hover:opacity-80 text-xs"
                  style={{ color: 'var(--content-text-dim)' }}
                  disabled={idx === sections.length - 1}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(idx)}
                  className="text-red-400 hover:text-red-600 text-xs font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }}
              placeholder="Add custom section…"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
            <Button variant="outline" onClick={addSection} disabled={!customSection.trim()}>
              Add
            </Button>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep('config')}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleGenerate} disabled={!canProceedFromSections}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Generate with Doki
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Generating ── */}
      {step === 'generating' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="relative">
            <SentinelAvatar sentinelId="doki" size={64} className="animate-pulse" />
            <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 text-indigo-500 animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-semibold" style={{ color: 'var(--content-text)' }}>Doki is writing your document…</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--content-text-dim)' }}>
              Channelling {standards.map((s) => ISO_STANDARD_LABELS[s]).join(', ')} domain expertise
            </p>
          </div>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-400">Document generated</span>
            </div>
            <div className="flex items-center gap-2">
              {clauseRefs.length > 0 && (
                <div className="flex items-center gap-1">
                  {clauseRefs.slice(0, 5).map((ref) => (
                    <Badge key={ref} variant="secondary" className="text-[10px]">{ref}</Badge>
                  ))}
                  {clauseRefs.length > 5 && (
                    <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>+{clauseRefs.length - 5}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed" style={{ color: 'var(--content-text)' }}>
              {generatedContent}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep('sections')}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Re-generate
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <FileText className="mr-1.5 h-4 w-4" />
              {saving ? 'Saving…' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
