'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, AlertCircle, TrendingUp, Calendar, ArrowUp } from 'lucide-react';
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

const PLAN_CREDIT_LIMITS: Record<PlanType, number> = {
  starter:      100,
  professional: 1000,
  enterprise:   10000,
};

const PLAN_PRICES: Record<PlanType, string> = {
  starter:      '$49 / mo',
  professional: '$199 / mo',
  enterprise:   'Custom',
};

const UPGRADE_TARGETS: PlanType[] = ['professional', 'enterprise'];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage]               = useState<BillingUsage | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade]   = useState(false);
  const [targetPlan, setTargetPlan]     = useState<PlanType | null>(null);
  const [upgrading, setUpgrading]       = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

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
      await billingApi.upgrade({ plan: targetPlan });
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
    pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#2563eb';

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const isTrialExpiringSoon =
    !!subscription?.trialEndsAt &&
    new Date(subscription.trialEndsAt).getTime() - Date.now() < 7 * 24 * 3600 * 1000 &&
    subscription.status === 'trial';

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Billing
          </p>
          <h1 className="mt-1 text-2xl font-bold">Billing & Subscription</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Manage your plan, AI credits, and payment details
          </p>
        </div>
        {!loading && subscription && subscription.plan !== 'enterprise' && (
          <Button onClick={() => setShowUpgrade(true)}>
            <ArrowUp className="mr-1.5 h-4 w-4" />
            Upgrade Plan
          </Button>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={load}
            className="ml-2 rounded px-2 py-0.5 text-xs font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────── */}
      {loading ? (
        <TableSkeleton rows={3} cols={2} />
      ) : subscription && usage ? (
        <>
          {/* ── Trial expiry warning ──────────────────────────────── */}
          {isTrialExpiringSoon && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                Your trial expires on{' '}
                <strong>{fmt(subscription.trialEndsAt!)}</strong>. Upgrade to keep full access.
              </span>
              <Button
                className="ml-auto"
                onClick={() => setShowUpgrade(true)}
              >
                Upgrade now
              </Button>
            </div>
          )}

          {/* ── Cards row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Subscription card */}
            <div
              className="rounded-xl border p-6"
              style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <p className="font-semibold">Current Subscription</p>
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
                    Period: <strong style={{ color: 'var(--content-text)' }}>
                      {fmt(subscription.currentPeriodStart)} – {fmt(subscription.currentPeriodEnd)}
                    </strong>
                  </span>
                </div>

                {subscription.trialEndsAt && subscription.status === 'trial' && (
                  <div
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: isTrialExpiringSoon ? '#d97706' : 'var(--content-text-muted)' }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    Trial expires: {fmt(subscription.trialEndsAt)}
                  </div>
                )}

                {subscription.wiseInvoiceId && (
                  <div className="flex items-center gap-2">
                    <span>Invoice:</span>
                    <span
                      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs"
                      style={{ color: 'var(--content-text)' }}
                    >
                      …{subscription.wiseInvoiceId.slice(-6)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Credits card */}
            <div
              className="rounded-xl border p-6"
              style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <p className="font-semibold">AI Credits — This Period</p>
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
                         : '#16a34a',
                  }}
                >
                  {usage.usagePercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
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
          </div>

          {/* ── Upgrade section ───────────────────────────────────── */}
          {subscription.plan !== 'enterprise' && (
            <div
              className="rounded-xl border p-6"
              style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
            >
              <p className="mb-1 font-semibold">Upgrade your plan</p>
              <p className="mb-5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                Unlock more AI credits, sites, and standards coverage.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {UPGRADE_TARGETS.filter(
                  (p) => ['starter', 'professional', 'enterprise'].indexOf(p) >
                         ['starter', 'professional', 'enterprise'].indexOf(subscription.plan),
                ).map((plan) => (
                  <div
                    key={plan}
                    className="flex flex-col gap-3 rounded-lg border p-4"
                    style={{ borderColor: 'var(--content-border)' }}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={PLAN_VARIANT[plan]}>{PLAN_LABELS[plan]}</Badge>
                      <span className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>
                        {PLAN_PRICES[plan]}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                      {PLAN_CREDIT_LIMITS[plan].toLocaleString()} AI credits / month
                    </p>
                    <Button
                      onClick={() => { setTargetPlan(plan); setShowUpgrade(true); }}
                    >
                      <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                      Upgrade to {PLAN_LABELS[plan]}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : !error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <CreditCard className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold">No subscription found</p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
              Contact support to set up your plan.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Upgrade Modal ─────────────────────────────────────────── */}
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
              <strong style={{ color: 'var(--content-text)' }}>{PLAN_LABELS[targetPlan]}</strong> plan
              ({PLAN_CREDIT_LIMITS[targetPlan].toLocaleString()} AI credits / month).
              The change takes effect immediately.
            </p>
          )}

          {upgradeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {upgradeError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowUpgrade(false); setTargetPlan(null); setUpgradeError(null); }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={upgrading || !targetPlan}>
              {upgrading ? 'Upgrading…' : `Upgrade to ${targetPlan ? PLAN_LABELS[targetPlan] : ''}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
