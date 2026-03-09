'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, AlertCircle, TrendingUp, Calendar, ArrowUp,
  Check, Minus, Shield, Zap,
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
import { TableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ─── Pricing Constants ─── */
const MONTHLY_PRICES: Record<PlanType, number> = {
  enterprise:   2497,
  professional: 1397,
  starter:      597,
};

const ANNUAL_PRICES: Record<PlanType, number> = {
  enterprise:   1997,
  professional: 1117,
  starter:      477,
};

const ACTION_LIMITS: Record<PlanType, string> = {
  enterprise:   '500',
  professional: '200',
  starter:      '50',
};

const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  enterprise:   'For teams running multi-site IMS across 3 standards',
  professional: 'Full compliance toolkit for growing manufacturers',
  starter:      'Perfect while you evaluate — most teams upgrade within 60 days',
};

/* Display order: Scale LEFT → Professional CENTER → Starter RIGHT (anchoring) */
const DISPLAY_ORDER: PlanType[] = ['enterprise', 'professional', 'starter'];

const DISPLAY_NAMES: Record<PlanType, string> = {
  enterprise:   'Scale',
  professional: 'Professional',
  starter:      'Starter',
};

/* ─── Feature Comparison ─── */
interface FeatureRow {
  feature: string;
  starter: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

const FEATURES: FeatureRow[] = [
  { feature: 'ISO 9001 / 14001 / 45001 coverage',  starter: true,         professional: true,        enterprise: true },
  { feature: 'Document Studio (AI generation)',      starter: true,         professional: true,        enterprise: true },
  { feature: 'AI-guided audit room',                 starter: '3/yr',       professional: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'CAPA engine with root-cause AI',       starter: true,         professional: true,        enterprise: true },
  { feature: 'Risk Navigator',                       starter: false,        professional: true,        enterprise: true },
  { feature: 'Management Review module',             starter: false,        professional: true,        enterprise: true },
  { feature: 'Compliance Matrix (gap detection)',     starter: true,         professional: true,        enterprise: true },
  { feature: 'Records Vault (tamper-proof)',          starter: '50 records', professional: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'AI actions per month',                  starter: '50',         professional: '200',       enterprise: '500' },
  { feature: 'Multi-site support',                    starter: false,        professional: '2 sites',   enterprise: 'Unlimited' },
  { feature: 'Custom sentinel training',              starter: false,        professional: false,       enterprise: true },
  { feature: 'Priority support',                      starter: false,        professional: true,        enterprise: true },
  { feature: 'SSO / SAML',                            starter: false,        professional: false,       enterprise: true },
  { feature: 'Dedicated success manager',             starter: false,        professional: false,       enterprise: true },
];

/* ─── Helpers ─── */
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtPrice = (cents: number) => `$${cents.toLocaleString()}`;

// Show savings for the most popular plan (Professional) — concrete number, not %.
const ANNUAL_SAVINGS_LABEL = `You save $${((MONTHLY_PRICES.professional - ANNUAL_PRICES.professional) * 12).toLocaleString()}/year`;

/* ─── Page ─── */
export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage]               = useState<BillingUsage | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade]   = useState(false);
  const [targetPlan, setTargetPlan]     = useState<PlanType | null>(null);
  const [upgrading, setUpgrading]       = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [annual, setAnnual]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, usageRes] = await Promise.all([
        billingApi.getSubscription(),
        billingApi.getUsage(),
      ]);
      setSubscription(subRes.data as Subscription);
      setUsage(usageRes.data as BillingUsage);
    } catch {
      setError('Failed to load billing information. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
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

  const creditsBarColor = (pct: number) =>
    pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : 'var(--sentinel-accent)';

  const currentPlan = subscription?.plan ?? 'starter';
  const planOrder: PlanType[] = ['starter', 'professional', 'enterprise'];
  const currentPlanIdx = planOrder.indexOf(currentPlan);

  const isTrialExpiringSoon =
    !!subscription?.trialEndsAt &&
    new Date(subscription.trialEndsAt).getTime() - Date.now() < 7 * 24 * 3600 * 1000 &&
    subscription.status === 'trial';

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl" style={{ color: 'var(--content-text)' }}>

      {/* ── Header ── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
          ISO Platform › Billing
        </p>
        <h1 className="mt-1 text-2xl font-bold">Plans & Billing</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
          Choose the plan that fits your compliance journey
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#F87171' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <TableSkeleton rows={3} cols={3} />
      ) : (
        <>
          {/* ── Trial expiry warning ── */}
          {isTrialExpiringSoon && (
            <div
              className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                Your trial expires on{' '}
                <strong>{fmt(subscription!.trialEndsAt!)}</strong>. Upgrade to keep full access.
              </span>
            </div>
          )}

          {/* ── Annual/Monthly Toggle (centered) ── */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex items-center rounded-lg p-1"
              style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
            >
              <button
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all"
                style={
                  !annual
                    ? { background: 'var(--sentinel-accent)', color: '#fff' }
                    : { color: 'var(--content-text-muted)' }
                }
                onClick={() => setAnnual(false)}
              >
                Monthly
              </button>
              <button
                className="rounded-md px-4 py-1.5 text-sm font-medium transition-all"
                style={
                  annual
                    ? { background: 'var(--sentinel-accent)', color: '#fff' }
                    : { color: 'var(--content-text-muted)' }
                }
                onClick={() => setAnnual(true)}
              >
                Annual
              </button>
            </div>
            {annual && (
              <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                {ANNUAL_SAVINGS_LABEL}
              </span>
            )}
          </div>

          {/* ── 3-Column Pricing Grid (Scale | Professional | Starter) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {DISPLAY_ORDER.map((plan) => {
              const price = annual ? ANNUAL_PRICES[plan] : MONTHLY_PRICES[plan];
              const monthlyPrice = MONTHLY_PRICES[plan];
              const annualSaving = (monthlyPrice - ANNUAL_PRICES[plan]) * 12;
              const isPopular = plan === 'professional';
              const isCurrent = plan === currentPlan;
              const canUpgrade = planOrder.indexOf(plan) > currentPlanIdx;
              const canDowngrade = planOrder.indexOf(plan) < currentPlanIdx;

              return (
                <div
                  key={plan}
                  className="relative flex flex-col rounded-xl p-6"
                  style={{
                    background: 'var(--content-surface)',
                    border: isPopular
                      ? '2px solid var(--sentinel-accent)'
                      : '1px solid var(--content-border)',
                  }}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap"
                      style={{ background: 'var(--sentinel-accent)' }}
                    >
                      Most Popular — chosen by 8 in 10 teams
                    </div>
                  )}

                  {/* Plan name + description */}
                  <div className="mb-4 mt-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold" style={{ color: 'var(--content-text)' }}>
                        {DISPLAY_NAMES[plan]}
                      </h3>
                      {isCurrent && <Badge variant="success">Current Plan</Badge>}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
                      {PLAN_DESCRIPTIONS[plan]}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-1">
                    <span className="text-3xl font-bold" style={{ color: 'var(--content-text)' }}>
                      {fmtPrice(price)}
                    </span>
                    <span className="text-sm ml-1" style={{ color: 'var(--content-text-muted)' }}>/mo</span>
                  </div>
                  {annual && annualSaving > 0 && (
                    <p className="text-xs font-medium mb-4" style={{ color: '#F59E0B' }}>
                      Save {fmtPrice(annualSaving)}/year
                    </p>
                  )}
                  {!annual && <div className="mb-4" />}

                  {/* Actions */}
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <Zap className="h-3.5 w-3.5" style={{ color: 'var(--sentinel-accent)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--content-text-muted)' }}>
                      {ACTION_LIMITS[plan]} AI actions/month
                    </span>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto">
                    {isCurrent ? (
                      <div
                        className="w-full rounded-lg py-2.5 text-center text-sm font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--content-text-muted)' }}
                      >
                        Current Plan
                      </div>
                    ) : canUpgrade ? (
                      <Button
                        className="w-full"
                        onClick={() => { setTargetPlan(plan); setShowUpgrade(true); }}
                      >
                        <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                        Upgrade to {DISPLAY_NAMES[plan]}
                      </Button>
                    ) : canDowngrade ? (
                      <div
                        className="w-full rounded-lg py-2.5 text-center text-sm font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--content-text-dim)' }}
                      >
                        Contact to downgrade
                      </div>
                    ) : null}

                    {/* Risk Reversal */}
                    <p className="text-[10px] text-center mt-2" style={{ color: 'var(--content-text-dim)' }}>
                      {plan === 'starter'
                        ? 'No credit card required to start'
                        : 'Cancel anytime'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Risk Reversal Banner ── */}
          <div
            className="rounded-xl px-6 py-4 text-center"
            style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="h-4 w-4" style={{ color: '#22C55E' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>
                Risk-Free Guarantee
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
              Cancel anytime. Full refund within 30 days. No questions asked.
            </p>
          </div>

          {/* ── Feature Comparison Table ── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
          >
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--content-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>
                Feature Comparison
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--content-border)' }}>
                    <th
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--content-text-muted)' }}
                    >
                      Feature
                    </th>
                    {DISPLAY_ORDER.map((plan) => (
                      <th
                        key={plan}
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--content-text-muted)' }}
                      >
                        {DISPLAY_NAMES[plan]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((row, i) => (
                    <tr
                      key={row.feature}
                      style={{
                        borderBottom: i < FEATURES.length - 1 ? '1px solid var(--content-border)' : undefined,
                      }}
                    >
                      <td className="px-6 py-3 text-[13px]" style={{ color: 'var(--content-text)' }}>
                        {row.feature}
                      </td>
                      {DISPLAY_ORDER.map((plan) => {
                        const val = row[plan];
                        return (
                          <td key={plan} className="px-4 py-3 text-center">
                            {val === true ? (
                              <Check className="inline h-4 w-4" style={{ color: '#22C55E' }} />
                            ) : val === false ? (
                              <Minus className="inline h-4 w-4" style={{ color: 'var(--content-text-dim)' }} />
                            ) : (
                              <span className="text-xs font-medium" style={{ color: 'var(--content-text-muted)' }}>
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Current Subscription Detail ── */}
          {subscription && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* Subscription card */}
              <div
                className="rounded-xl border p-6"
                style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <CreditCard className="h-5 w-5" style={{ color: 'var(--sentinel-accent)' }} />
                  </div>
                  <p className="font-semibold" style={{ color: 'var(--content-text)' }}>Current Subscription</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant={PLAN_VARIANT[subscription.plan]}>
                    {PLAN_LABELS[subscription.plan]}
                  </Badge>
                  <Badge variant={SUB_STATUS_VARIANT[subscription.status]}>
                    {SUB_STATUS_LABELS[subscription.status]}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Period:{' '}
                      <strong style={{ color: 'var(--content-text)' }}>
                        {fmt(subscription.currentPeriodStart)} – {fmt(subscription.currentPeriodEnd)}
                      </strong>
                    </span>
                  </div>

                  {subscription.trialEndsAt && subscription.status === 'trial' && (
                    <div
                      className="flex items-center gap-2 text-sm font-medium"
                      style={{ color: isTrialExpiringSoon ? '#F59E0B' : 'var(--content-text-muted)' }}
                    >
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      Trial expires: {fmt(subscription.trialEndsAt)}
                    </div>
                  )}

                  {subscription.wiseInvoiceId && (
                    <div className="flex items-center gap-2">
                      <span>Invoice:</span>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-xs"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--content-text)' }}
                      >
                        …{subscription.wiseInvoiceId.slice(-6)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Credits card */}
              {usage && (
                <div
                  className="rounded-xl border p-6"
                  style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(139,92,246,0.12)' }}
                    >
                      <TrendingUp className="h-5 w-5" style={{ color: '#8B5CF6' }} />
                    </div>
                    <p className="font-semibold" style={{ color: 'var(--content-text)' }}>AI Credits — This Period</p>
                  </div>

                  <div className="mb-3 flex items-end justify-between">
                    <span className="text-2xl font-bold" style={{ color: 'var(--content-text)' }}>
                      {usage.aiCreditsUsed.toLocaleString()}
                      <span className="ml-1 text-sm font-normal" style={{ color: 'var(--content-text-muted)' }}>
                        / {usage.aiCreditsLimit.toLocaleString()} used
                      </span>
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: usage.usagePercent >= 90 ? '#dc2626'
                             : usage.usagePercent >= 70 ? '#d97706'
                             : '#22C55E',
                      }}
                    >
                      {usage.usagePercent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="mb-3 h-2.5 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--content-border)' }}
                  >
                    <div
                      className="h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(usage.usagePercent, 100)}%`,
                        background: creditsBarColor(usage.usagePercent),
                      }}
                    />
                  </div>

                  <div className="space-y-1 text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    <div className="flex justify-between">
                      <span>{usage.creditsRemaining.toLocaleString()} credits remaining</span>
                      <span>Resets {fmt(usage.periodEnd)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Upgrade Modal ── */}
      <Modal
        open={showUpgrade}
        onOpenChange={(o) => {
          setShowUpgrade(o);
          if (!o) { setTargetPlan(null); setUpgradeError(null); }
        }}
        title="Confirm Plan Upgrade"
      >
        <div className="flex flex-col gap-4">
          {targetPlan && (
            <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
              You are upgrading to the{' '}
              <strong style={{ color: 'var(--content-text)' }}>{DISPLAY_NAMES[targetPlan]}</strong> plan
              at <strong style={{ color: 'var(--content-text)' }}>
                {fmtPrice(annual ? ANNUAL_PRICES[targetPlan] : MONTHLY_PRICES[targetPlan])}/mo
              </strong>
              {annual ? ' (billed annually)' : ''}.
              The change takes effect immediately.
            </p>
          )}

          {upgradeError && (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#F87171' }}
            >
              {upgradeError}
            </div>
          )}

          <p className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>
            Cancel anytime. Full refund within 30 days. No questions asked.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowUpgrade(false); setTargetPlan(null); setUpgradeError(null); }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={upgrading || !targetPlan}>
              {upgrading ? 'Upgrading…' : `Upgrade to ${targetPlan ? DISPLAY_NAMES[targetPlan] : ''}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
