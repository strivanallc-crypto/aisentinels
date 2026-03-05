'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Building2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { settingsApi } from '@/lib/api';
import type { OrgContext } from '@/lib/types';

const INDUSTRIES = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'construction', label: 'Construction' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
];

const CERT_TARGETS = [
  { code: 'ISO 9001', label: 'ISO 9001', color: '#3B82F6' },
  { code: 'ISO 14001', label: 'ISO 14001', color: '#22C55E' },
  { code: 'ISO 45001', label: 'ISO 45001', color: '#F59E0B' },
];

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
const inputStyle = {
  background: '#1E293B',
  borderColor: 'rgba(255,255,255,0.07)',
  color: '#F9FAFB',
};

export function OrgTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    country: '',
    employeeCount: '',
    imsScope: '',
    certificationTargets: [] as string[],
  });

  useEffect(() => {
    settingsApi
      .getOrg()
      .then(({ data }) => {
        const org = data as OrgContext | null;
        if (org) {
          setForm({
            companyName: org.companyName ?? '',
            industry: org.industry ?? '',
            country: org.country ?? '',
            employeeCount: org.employeeCount?.toString() ?? '',
            imsScope: org.imsScope ?? '',
            certificationTargets: org.certificationTargets ?? [],
          });
        } else {
          setIsNew(true);
        }
      })
      .catch(() => toast({ title: 'Failed to load organisation', variant: 'error' }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await settingsApi.updateOrg({
        companyName: form.companyName || null,
        industry: form.industry || null,
        country: form.country || null,
        employeeCount: form.employeeCount ? parseInt(form.employeeCount, 10) : null,
        imsScope: form.imsScope || null,
        certificationTargets: form.certificationTargets,
      });
      setIsNew(false);
      toast({ title: 'Saved', variant: 'success' });
    } catch {
      toast({ title: 'Failed to save', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [form, toast]);

  const toggleCert = (code: string) => {
    setForm((prev) => ({
      ...prev,
      certificationTargets: prev.certificationTargets.includes(code)
        ? prev.certificationTargets.filter((c) => c !== code)
        : [...prev.certificationTargets, code],
    }));
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Onboarding card for new orgs
  if (isNew) {
    return (
      <div className="max-w-2xl">
        <div
          className="rounded-[10px] border p-8 text-center"
          style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <Sparkles className="mx-auto h-10 w-10 text-indigo-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Welcome! Set up your organisation
          </h3>
          <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
            Tell us about your company so the AI Sentinels can tailor
            ISO documentation and audits to your context.
          </p>
          <Button onClick={() => setIsNew(false)}>
            <Building2 className="mr-1.5 h-4 w-4" />
            Get Started
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div
        className="rounded-[10px] border p-5"
        style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Organisation Profile
        </h3>

        <div className="space-y-4">
          {/* Company Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              onBlur={save}
              placeholder="e.g. Acme Manufacturing Ltd"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Industry + Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Industry</label>
              <select
                value={form.industry}
                onChange={(e) => {
                  setForm((f) => ({ ...f, industry: e.target.value }));
                  // Trigger save after state update
                  setTimeout(save, 0);
                }}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                onBlur={save}
                placeholder="e.g. United Kingdom"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Employee Count */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Employee Count</label>
            <input
              type="number"
              value={form.employeeCount}
              onChange={(e) => setForm((f) => ({ ...f, employeeCount: e.target.value }))}
              onBlur={save}
              placeholder="e.g. 250"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* IMS Scope */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              IMS Scope
            </label>
            <textarea
              value={form.imsScope}
              onChange={(e) => setForm((f) => ({ ...f, imsScope: e.target.value }))}
              onBlur={save}
              placeholder="Describe the scope of your Integrated Management System..."
              rows={3}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Certification Targets */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Certification Targets
            </label>
            <div className="flex flex-wrap gap-2">
              {CERT_TARGETS.map((ct) => {
                const active = form.certificationTargets.includes(ct.code);
                return (
                  <button
                    key={ct.code}
                    onClick={() => {
                      toggleCert(ct.code);
                      setTimeout(save, 0);
                    }}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors"
                    style={{
                      borderColor: active ? ct.color : 'rgba(255,255,255,0.07)',
                      background: active ? `${ct.color}15` : 'transparent',
                      color: active ? ct.color : '#9CA3AF',
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: active ? ct.color : '#4B5563' }}
                    />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>
    </div>
  );
}
