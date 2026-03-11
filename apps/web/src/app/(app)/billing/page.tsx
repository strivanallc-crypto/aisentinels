'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, TrendingUp, Calendar, ArrowUp,
  Check, Minus, Shield, Zap, AlertCircle,
} from 'lucide-react';
import { billingApi } from '@/lib/api';
import type { Subscription, BillingUsage, PlanType } from '@/lib/types';
import {
  PLAN_LABELS,
  PLAN_VARIANT,
  SUB_STATUS_LABELS,
  SUB_STATUS_VARIANT,
} from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SentinelPageHero,
  ContentCard,
  PageSkeleton,
  SectionLabel,
} from '@/components/ui/sentinel-page-hero';

/* ─── Pricing Constants ─── */
const MONTHLY_PRICES: Record<PlanType, number> = { enterprise: 2497, professional: 1397, starter: 597 };
const ANNUAL_PRICES: Record<PlanType, number> = { enterprise: 1997, professional: 1117, starter: 477 };
const ACTION_LIMITS: Record<PlanType, string> = { enterprise: '500', professional: '200', starter: '50' };
const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  enterprise: 'For teams running multi-site IMS across 3 standards',
  professional: 'Full compliance toolkit for growing manufacturers',
  starter: 'Perfect while you evaluate — most teams upgrade within 60 days',
};
const DISPLAY_ORDER: PlanType[] = ['enterprise', 'professional', 'starter'];
const DISPLAY_NAMES: Record<PlanType, string> = { enterprise: 'Scale', professional: 'Professional', starter: 'Starter' };

interface FeatureRow { feature: string; starter: boolean | string; professional: boolean | string; enterprise: boolean | string; }
const FEATURES: FeatureRow[] = [
  { feature: 'ISO 9001 / 14001 / 45001 coverage', starter: true, professional: true, enterprise: true },
  { feature: 'Document Studio (AI generation)', starter: true, professional: true, enterprise: true },
  { feature: 'AI-guided audit room', starter: '3/yr', professional: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'CAPA engine with root-cause AI', starter: true, professional: true, enterprise: true },
  { feature: 'Risk Navigator', starter: false, professional: true, enterprise: true },
  { feature: 'Management Review module', starter: false, professional: true, enterprise: true },
  { feature: 'Compliance Matrix (gap detection)', starter: true, professional: true, enterprise: true },
  { feature: 'Records Vault (tamper-proof)', starter: '50 records', professional: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'AI actions per month', starter: '50', professional: '200', enterprise: '500' },
  { feature: 'Multi-site support', starter: false, professional: '2 sites', enterprise: 'Unlimited' },
  { feature: 'Custom sentinel training', starter: false, professional: false, enterprise: true },
  { feature: 'Priority support', starter: false, professional: true, enterprise: true },
  { feature: 'SSO / SAML', starter: false, professional: false, enterprise: true },
  { feature: 'Dedicated success manager', starter: false, professional: false, enterprise: true },
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtPrice = (cents: number) => `$${cents.toLocaleString()}`;
const ANNUAL_SAVINGS_LABEL = `You save $${((MONTHLY_PRICES.professional - ANNUAL_PRICES.professional) * 12).toLocaleString()}/year`;

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanType | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, usageRes] = await Promise.all([billingApi.getSubscription(), billingApi.getUsage()]);
      setSubscription(subRes.data as Subscription);
      setUsage(usageRes.data as BillingUsage);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async () => {
    if (!targetPlan) return;
    setUpgrading(true);
    setUpgradeError(null);
    try {
      await billingApi.upgrade({ plan: targetPlan, billingCycle: annual ? 'annual' : 'monthly' });
      setShowUpgrade(false);
      setTargetPlan(null);
      await load();
    } catch {
      setUpgradeError('Failed to upgrade plan. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const creditsBarColor = (pct: number) => pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#c2fa69';
  const currentPlan = subscription?.plan ?? 'starter';
  const planOrder: PlanType[] = ['starter', 'professional', 'enterprise'];
  const currentPlanIdx = planOrder.indexOf(currentPlan);
  const isTrialExpiringSoon = !!subscription?.trialEndsAt && new Date(subscription.trialEndsAt).getTime() - Date.now() < 7 * 24 * 3600 * 1000 && subscription.status === 'trial';

  return (
    <div className="p-6 max-w-[1280px]">
      <SentinelPageHero
        sectionLabel="BILLING"
        title="Your Plan. Your Usage."
        subtitle="Choose the plan that fits your compliance journey."
        sentinelColor="#c2fa69"
        stats={
          loading || !usage
            ? undefined
            : [
                { value: `${usage.aiCreditsUsed}/${usage.aiCreditsLimit}`, label: 'AI Credits Used' },
                { value: `${usage.usagePercent}%`, label: 'Utilisation' },
              ]
        }
      />

      {loading ? (
        <PageSkeleton rows={4} />
      ) : (
        <>
          {/* Trial warning */}
          {isTrialExpiringSoon && (
            <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Your trial expires on <strong>{fmt(subscription!.trialEndsAt!)}</strong>. Upgrade to keep full access.
            </div>
          )}

          {/* Annual/Monthly toggle */}
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="flex items-center rounded-full p-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <button className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${!annual ? 'text-[#0a0a0a]' : ''}`} style={!annual ? { background: '#c2fa69' } : { color: 'var(--muted)' }} onClick={() => setAnnual(false)}>Monthly</button>
              <button className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${annual ? 'text-[#0a0a0a]' : ''}`} style={annual ? { background: '#c2fa69' } : { color: 'var(--muted)' }} onClick={() => setAnnual(true)}>Annual</button>
            </div>
            {annual && <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>{ANNUAL_SAVINGS_LABEL}</span>}
          </div>

          {/* 3-Column Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {DISPLAY_ORDER.map((plan) => {
              const price = annual ? ANNUAL_PRICES[plan] : MONTHLY_PRICES[plan];
              const monthlyPrice = MONTHLY_PRICES[plan];
              const annualSaving = (monthlyPrice - ANNUAL_PRICES[plan]) * 12;
              const isPopular = plan === 'professional';
              const isCurrent = plan === currentPlan;
              const canUpgrade = planOrder.indexOf(plan) > currentPlanIdx;
              const canDowngrade = planOrder.indexOf(plan) < currentPlanIdx;

              return (
                <div key={plan} className="relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]" style={{ background: 'var(--card-bg)', border: isPopular ? '2px solid #c2fa69' : '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ background: '#c2fa69', color: '#0a0a0a' }}>Most Popular</div>
                  )}
                  <div className="mb-4 mt-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold font-heading">{DISPLAY_NAMES[plan]}</h3>
                      {isCurrent && <Badge variant="success">Current</Badge>}
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{PLAN_DESCRIPTIONS[plan]}</p>
                  </div>
                  <div className="mb-1">
                    <span className="text-3xl font-bold font-heading">{fmtPrice(price)}</span>
                    <span className="text-sm ml-1" style={{ color: 'var(--muted)' }}>/mo</span>
                  </div>
                  {annual && annualSaving > 0 ? (
                    <p className="text-xs font-medium mb-4" style={{ color: '#F59E0B' }}>Save {fmtPrice(annualSaving)}/year</p>
                  ) : <div className="mb-4" />}
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5" style={{ background: 'var(--row-hover)' }}>
                    <Zap className="h-3.5 w-3.5" style={{ color: '#c2fa69' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{ACTION_LIMITS[plan]} AI actions/month</span>
                  </div>
                  <div className="mt-auto">
                    {isCurrent ? (
                      <div className="w-full rounded-full py-2.5 text-center text-sm font-semibold" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>Current Plan</div>
                    ) : canUpgrade ? (
                      <button onClick={() => { setTargetPlan(plan); setShowUpgrade(true); }} className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]" style={{ background: '#c2fa69', color: '#0a0a0a' }}>
                        <ArrowUp className="h-3.5 w-3.5" /> Upgrade to {DISPLAY_NAMES[plan]}
                      </button>
                    ) : canDowngrade ? (
                      <div className="w-full rounded-full py-2.5 text-center text-sm font-semibold" style={{ background: 'var(--surface)', color: 'var(--content-text-dim)' }}>Contact to downgrade</div>
                    ) : null}
                    <p className="text-[10px] text-center mt-2" style={{ color: 'var(--content-text-dim)' }}>{plan === 'starter' ? 'No credit card required to start' : 'Cancel anytime'}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Risk Reversal Banner */}
          <ContentCard className="mb-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Shield className="h-4 w-4" style={{ color: '#22C55E' }} />
                <span className="text-sm font-semibold">Risk-Free Guarantee</span>
              </div>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Cancel anytime. Full refund within 30 days. No questions asked.</p>
            </div>
          </ContentCard>

          {/* Feature Comparison Table */}
          <SectionLabel>FEATURE COMPARISON</SectionLabel>
          <ContentCard className="mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Feature</th>
                    {DISPLAY_ORDER.map((plan) => (
                      <th key={plan} className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{DISPLAY_NAMES[plan]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((row, i) => (
                    <tr key={row.feature} style={{ borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td className="px-4 py-3 text-[13px]">{row.feature}</td>
                      {DISPLAY_ORDER.map((plan) => {
                        const val = row[plan];
                        return (
                          <td key={plan} className="px-4 py-3 text-center">
                            {val === true ? <Check className="inline h-4 w-4" style={{ color: '#22C55E' }} /> : val === false ? <Minus className="inline h-4 w-4" style={{ color: 'var(--content-text-dim)' }} /> : <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{val}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentCard>

          {/* Current Subscription Detail */}
          {subscription && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ContentCard>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.12)' }}>
                    <CreditCard className="h-5 w-5" style={{ color: '#c2fa69' }} />
                  </div>
                  <p className="font-semibold">Current Subscription</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant={PLAN_VARIANT[subscription.plan]}>{PLAN_LABELS[subscription.plan]}</Badge>
                  <Badge variant={SUB_STATUS_VARIANT[subscription.status]}>{SUB_STATUS_LABELS[subscription.status]}</Badge>
                </div>
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Period: <strong className="text-white">{fmt(subscription.currentPeriodStart)} – {fmt(subscription.currentPeriodEnd)}</strong></span>
                  </div>
                  {subscription.trialEndsAt && subscription.status === 'trial' && (
                    <div className="flex items-center gap-2" style={{ color: isTrialExpiringSoon ? '#F59E0B' : 'var(--text-secondary)' }}>
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> Trial expires: {fmt(subscription.trialEndsAt)}
                    </div>
                  )}
                  {subscription.wiseInvoiceId && (
                    <div className="flex items-center gap-2">
                      Invoice: <span className="rounded px-1.5 py-0.5 font-mono text-xs" style={{ background: 'var(--surface)' }}>{'\u2026'}{subscription.wiseInvoiceId.slice(-6)}</span>
                    </div>
                  )}
                </div>
              </ContentCard>
              {usage && (
                <ContentCard>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(139,92,246,0.12)' }}>
                      <TrendingUp className="h-5 w-5" style={{ color: '#8B5CF6' }} />
                    </div>
                    <p className="font-semibold">AI Credits — This Period</p>
                  </div>
                  <div className="mb-3 flex items-end justify-between">
                    <span className="text-2xl font-bold font-heading">
                      {usage.aiCreditsUsed.toLocaleString()}
                      <span className="ml-1 text-sm font-normal" style={{ color: 'var(--muted)' }}>/ {usage.aiCreditsLimit.toLocaleString()} used</span>
                    </span>
                    <span className="text-sm font-semibold" style={{ color: usage.usagePercent >= 90 ? '#dc2626' : usage.usagePercent >= 70 ? '#d97706' : '#22C55E' }}>
                      {usage.usagePercent}%
                    </span>
                  </div>
                  <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(usage.usagePercent, 100)}%`, background: creditsBarColor(usage.usagePercent) }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                    <span>{usage.creditsRemaining.toLocaleString()} remaining</span>
                    <span>Resets {fmt(usage.periodEnd)}</span>
                  </div>
                </ContentCard>
              )}
            </div>
          )}
        </>
      )}

      {/* Upgrade Modal */}
      <Modal open={showUpgrade} onOpenChange={(o) => { setShowUpgrade(o); if (!o) { setTargetPlan(null); setUpgradeError(null); } }} title="Confirm Plan Upgrade">
        <div className="flex flex-col gap-4">
          {targetPlan && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You are upgrading to the <strong className="text-white">{DISPLAY_NAMES[targetPlan]}</strong> plan at <strong className="text-white">{fmtPrice(annual ? ANNUAL_PRICES[targetPlan] : MONTHLY_PRICES[targetPlan])}/mo</strong>{annual ? ' (billed annually)' : ''}. The change takes effect immediately.
            </p>
          )}
          {upgradeError && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>{upgradeError}</div>
          )}
          <p className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>Cancel anytime. Full refund within 30 days. No questions asked.</p>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowUpgrade(false); setTargetPlan(null); setUpgradeError(null); }}>Cancel</Button>
            <Button onClick={handleUpgrade} disabled={upgrading || !targetPlan}>{upgrading ? 'Upgrading...' : `Upgrade to ${targetPlan ? DISPLAY_NAMES[targetPlan] : ''}`}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
