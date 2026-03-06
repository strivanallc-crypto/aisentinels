'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { LogOut, Shield, ChevronRight, Lock } from 'lucide-react';
import { NAV_ITEMS } from './nav-items';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { SENTINELS, SENTINEL_LIST } from '@/lib/sentinels';
import { billingApi } from '@/lib/api';
import type { PlanType } from '@/lib/types';

const PLAN_ORDER: PlanType[] = ['starter', 'professional', 'enterprise'];

interface SidebarProps {
  session: Session;
  currentPlan?: PlanType;
}

export function Sidebar({ session, currentPlan = 'starter' }: SidebarProps) {
  const pathname = usePathname();
  const email   = session.user?.email ?? '';
  const initial = email.charAt(0).toUpperCase();
  const planIdx = PLAN_ORDER.indexOf(currentPlan);

  // Actions remaining
  const [actionsRemaining, setActionsRemaining] = useState(100);
  const [actionsLimit, setActionsLimit] = useState(100);

  useEffect(() => {
    billingApi
      .getUsage()
      .then((res) => {
        const d = res.data as { creditsRemaining?: number; aiCreditsLimit?: number } | null;
        if (d) {
          setActionsRemaining(d.creditsRemaining ?? 100);
          setActionsLimit(d.aiCreditsLimit ?? 100);
        }
      })
      .catch(() => {});
  }, []);

  const actionsLow = actionsLimit > 0 && actionsRemaining / actionsLimit < 0.2;

  return (
    <aside
      className="flex w-[220px] flex-shrink-0 flex-col"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'var(--sentinel-blue)' }}
        >
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white leading-tight">AI Sentinels</p>
          <p className="text-[10px] leading-tight" style={{ color: 'var(--sidebar-text-muted)' }}>
            ISO Compliance
          </p>
        </div>
        <SentinelAvatar sentinelId="qualy" size={22} className="opacity-75" />
      </div>

      {/* ── Cmd+K hint ── */}
      <div
        className="mx-3 mt-3 mb-1 flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors"
        style={{ background: 'var(--sidebar-surface)', border: '1px solid var(--sidebar-border)' }}
        onClick={() => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
          );
        }}
      >
        <kbd
          className="text-[10px] rounded px-1 py-0.5 font-mono"
          style={{ background: 'var(--sidebar-border)', color: 'var(--sidebar-text-dim)' }}
        >
          ⌘K
        </kbd>
        <span className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>
          Quick navigate…
        </span>
      </div>

      {/* ── Onboarding Progress (Zeigarnik / Loss Aversion) ── */}
      <div
        className="mx-3 mt-2 mb-1 rounded-md px-3 py-2.5"
        style={{ background: 'var(--sidebar-surface)' }}
      >
        <p className="text-[10px] mb-1.5 leading-relaxed" style={{ color: 'var(--sidebar-text)' }}>
          You're 20% there — complete setup to unlock full compliance coverage
        </p>
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            Setup
          </span>
          <span className="text-[10px] font-bold" style={{ color: 'var(--sentinel-accent)' }}>
            1 of 5
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--sidebar-border)' }}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: '20%', background: 'var(--sentinel-accent)' }}
          />
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = pathname === href;
          const isLocked =
            item.requiredPlan
              ? PLAN_ORDER.indexOf(item.requiredPlan) > planIdx
              : false;

          if (isLocked) {
            return (
              <div
                key={href}
                title="Unlock with Professional — used by 73% of manufacturing clients"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] opacity-50 cursor-not-allowed select-none"
                style={{ color: 'var(--sidebar-text-dim)' }}
              >
                <div className="relative flex-shrink-0">
                  <Icon className="h-4 w-4" style={{ color: 'var(--sidebar-text-muted)' }} />
                </div>
                <span className="truncate flex-1">{label}</span>
                <Lock className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--sidebar-text-muted)' }} />
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-all"
              style={
                active
                  ? {
                      background: 'var(--sidebar-active-bg)',
                      color: 'var(--sidebar-active-text)',
                      fontWeight: 500,
                    }
                  : { color: 'var(--sidebar-text-dim)' }
              }
            >
              <div className="relative flex-shrink-0">
                <Icon
                  className="h-4 w-4"
                  style={{
                    color: active ? 'var(--sidebar-active-icon)' : 'var(--sidebar-text-muted)',
                  }}
                />
                {item.sentinelId && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full overflow-hidden"
                    style={{ backgroundColor: SENTINELS[item.sentinelId].color }}
                  >
                    <span className="text-[7px] font-bold text-white leading-none">
                      {SENTINELS[item.sentinelId].initial}
                    </span>
                  </span>
                )}
              </div>
              <span className="truncate flex-1">{label}</span>
              {active && (
                <ChevronRight
                  className="h-3 w-3 flex-shrink-0 opacity-50"
                  style={{ color: 'var(--sentinel-accent)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Actions Remaining ── */}
      <div
        className="mx-3 mb-2 rounded-md px-3 py-2.5"
        style={{ background: 'var(--sidebar-surface)' }}
      >
        {actionsLow ? (
          <p className="text-[10px] mb-1.5 leading-relaxed" style={{ color: '#F59E0B' }}>
            Only {actionsRemaining} actions left this month — upgrade for 5x more
          </p>
        ) : (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold" style={{ color: 'var(--sidebar-text-muted)' }}>
              Actions remaining
            </span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--sidebar-text)' }}>
              {actionsRemaining} of {actionsLimit}
            </span>
          </div>
        )}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--sidebar-border)' }}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${actionsLimit > 0 ? (actionsRemaining / actionsLimit) * 100 : 100}%`,
              background: actionsLow ? '#F59E0B' : 'var(--sentinel-accent)',
            }}
          />
        </div>
      </div>

      {/* ── Sentinels Status ── */}
      <div
        className="mx-3 mb-2 flex items-center gap-2 rounded-md px-3 py-2"
        style={{ background: 'var(--sidebar-surface)' }}
      >
        <div className="flex items-center gap-1">
          {SENTINEL_LIST.map((s) => (
            <SentinelAvatar key={s.id} sentinelId={s.id} size={14} />
          ))}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
          6 Sentinels Online
        </span>
      </div>

      {/* ── User ── */}
      <div className="p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: 'var(--sentinel-blue)' }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[11px] font-medium"
              style={{ color: 'var(--sidebar-text)' }}
            >
              {email}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
              Admin
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
            className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
