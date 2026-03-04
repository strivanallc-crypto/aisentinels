'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Copy, Check, ChevronLeft } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Audie } from '@/components/sentinels/audie';
import { aiApi } from '@/lib/api';
import type { IsoStandard } from '@/lib/types';
import { ISO_STANDARD_LABELS } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STANDARDS: { value: IsoStandard; label: string; color: string }[] = [
  { value: 'iso_9001', label: 'ISO 9001', color: '#3B82F6' },
  { value: 'iso_14001', label: 'ISO 14001', color: '#22C55E' },
  { value: 'iso_45001', label: 'ISO 45001', color: '#F59E0B' },
];

const AUDIT_TYPES = [
  { value: 'internal', label: 'Internal Audit' },
  { value: 'supplier', label: 'Supplier Audit' },
  { value: 'certification', label: 'Certification Audit' },
  { value: 'surveillance', label: 'Surveillance Audit' },
];

export function AiPlanModal({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<'config' | 'generating' | 'result'>('config');
  const [standards, setStandards] = useState<IsoStandard[]>(['iso_9001']);
  const [scope, setScope] = useState('');
  const [auditType, setAuditType] = useState('internal');
  const [orgContext, setOrgContext] = useState('');
  const [plan, setPlan] = useState('');
  const [clauseChecklist, setClauseChecklist] = useState<string[]>([]);
  const [evidenceReqs, setEvidenceReqs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep('config');
    setStandards(['iso_9001']);
    setScope('');
    setAuditType('internal');
    setOrgContext('');
    setPlan('');
    setClauseChecklist([]);
    setEvidenceReqs([]);
    setError(null);
    setCopied(false);
  };

  const toggleStandard = (s: IsoStandard) => {
    setStandards((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleGenerate = async () => {
    setStep('generating');
    setError(null);
    try {
      const res = await aiApi.auditPlan({
        standards,
        scope: scope || 'Full management system scope',
        auditType,
        orgContext: orgContext || 'Generic organisation',
      });
      const data = res.data as {
        plan: string;
        clauseChecklist: string[];
        evidenceRequirements: string[];
      };
      setPlan(data.plan);
      setClauseChecklist(data.clauseChecklist ?? []);
      setEvidenceReqs(data.evidenceRequirements ?? []);
      setStep('result');
    } catch {
      setError('Audie could not generate the audit plan. Please try again.');
      setStep('config');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(plan);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title=""
      className="max-w-2xl"
    >
      <div className="mb-5 flex items-center gap-3 -mt-2">
        <Audie size={36} />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Audie — AI Audit Planner</h2>
          <p className="text-xs text-gray-500">
            {step === 'config' && 'Configure audit plan per ISO 19011:6.3'}
            {step === 'generating' && 'Generating audit plan…'}
            {step === 'result' && 'Review your audit plan'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Config */}
      {step === 'config' && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">ISO Standards</label>
            <div className="flex gap-2">
              {STANDARDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleStandard(s.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    standards.includes(s.value)
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Audit Type</label>
              <select
                value={auditType}
                onChange={(e) => setAuditType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              >
                {AUDIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Audit Scope</label>
            <textarea
              rows={2}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Define the scope of the audit…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Organisation Context <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={orgContext}
              onChange={(e) => setOrgContext(e.target.value)}
              placeholder="Industry, size, key processes…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleGenerate} disabled={standards.length === 0}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Generate Audit Plan
            </Button>
          </div>
        </div>
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="relative">
            <Audie size={64} className="animate-pulse" />
            <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 text-rose-500 animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800">Audie is planning your audit…</p>
            <p className="mt-1 text-sm text-gray-500">
              Per ISO 19011:6.3 for {standards.map((s) => ISO_STANDARD_LABELS[s]).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {step === 'result' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">Audit plan ready</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          {/* Clause checklist */}
          {clauseChecklist.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs font-semibold text-gray-500 mr-1">Clauses:</span>
              {clauseChecklist.slice(0, 15).map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
              ))}
              {clauseChecklist.length > 15 && (
                <span className="text-xs text-gray-400">+{clauseChecklist.length - 15}</span>
              )}
            </div>
          )}

          {/* Evidence requirements */}
          {evidenceReqs.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Evidence Required</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {evidenceReqs.slice(0, 8).map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-gray-400 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan content */}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
              {plan}
            </pre>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep('config')}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Re-generate
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
