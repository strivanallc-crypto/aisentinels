'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { LogOut, Lock, Calendar, PanelLeftClose, PanelLeft } from 'lucide-react';
import { NAV_GROUPS } from './nav-items';
import type { PlanType } from '@/lib/types';

/* Calendly global — loaded via <Script> in root layout */
declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (opts: { url: string }) => void;
    };
  }
}

const PLAN_ORDER: PlanType[] = ['starter', 'professional', 'enterprise'];

/* ── Animated Neon Logo (Sadewa circuit-board style) ────────────────────── */
function NeonLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Glow backdrop */}
      <div
        className="absolute inset-0 rounded-xl animate-neon-pulse"
        style={{ background: 'var(--accent)', opacity: 0.15 }}
      />
      {/* Circuit-board style shield */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="relative z-10 animate-neon-pulse"
        style={{ width: size, height: size }}
      >
        {/* Shield body */}
        <path
          d="M16 2L4 8v8c0 7.18 5.12 13.88 12 16 6.88-2.12 12-8.82 12-16V8L16 2z"
          fill="var(--accent)"
          fillOpacity="0.15"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Circuit traces */}
        <path
          d="M16 8v6m0 0h4m-4 0h-4"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="animate-circuit-trace"
        />
        <circle cx="16" cy="14" r="1.5" fill="var(--accent)" />
        <circle cx="20" cy="14" r="1" fill="var(--accent)" fillOpacity="0.6" />
        <circle cx="12" cy="14" r="1" fill="var(--accent)" fillOpacity="0.6" />
        {/* Bottom circuit nodes */}
        <path
          d="M12 18h8"
          stroke="var(--accent)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeOpacity="0.4"
        />
        <circle cx="12" cy="18" r="0.8" fill="var(--accent)" fillOpacity="0.4" />
        <circle cx="20" cy="18" r="0.8" fill="var(--accent)" fillOpacity="0.4" />
        <circle cx="16" cy="22" r="0.8" fill="var(--accent)" fillOpacity="0.3" />
        <path
          d="M16 18v4"
          stroke="var(--accent)"
          strokeWidth="0.8"
          strokeOpacity="0.3"
        />
      </svg>
    </div>
  );
}

/* ── Sidebar Component ──────────────────────────────────────────────────── */
interface SidebarProps {
  session: Session;
  currentPlan?: PlanType;
}

export function Sidebar({ session, currentPlan = 'starter' }: SidebarProps) {
  const pathname = usePathname();
  const email    = session.user?.email ?? '';
  const initial  = email.charAt(0).toUpperCase();
  const planIdx  = PLAN_ORDER.indexOf(currentPlan);

  // Responsive collapse — auto-collapse below lg breakpoint
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    setCollapsed(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const openCalendly = () => {
    window.Calendly?.initPopupWidget({
      url: 'https://calendly.com/julio-aisentinels',
    });
  };

  return (
    <aside
      className={`flex flex-shrink-0 flex-col h-screen transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-[260px]'
      }`}
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-3 py-5 ${collapsed ? 'justify-center px-2' : 'px-5'}`}
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <NeonLogo size={collapsed ? 28 : 32} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-bold leading-tight font-heading tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              AI Sentinels
            </p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--sidebar-text-dim)' }}>
              ISO Compliance Platform
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex-shrink-0 rounded-lg p-1.5 transition-all duration-200"
            style={{ color: 'var(--sidebar-text-dim)' }}
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button (collapsed state) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--sidebar-text-dim)' }}
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* ── Nav ── */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-6 ${collapsed ? 'px-1.5' : 'px-3'}`}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: 'var(--sidebar-text-dim)' }}
              >
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const { href, label, icon: Icon } = item;
                const active = pathname === href || pathname.startsWith(href + '/');
                const isLocked = item.requiredPlan
                  ? PLAN_ORDER.indexOf(item.requiredPlan) > planIdx
                  : false;

                if (isLocked) {
                  return (
                    <div
                      key={href}
                      title={collapsed ? `${label} (Locked)` : 'Upgrade to Professional'}
                      className={`flex items-center gap-3 rounded-xl py-2 text-[13px] opacity-35 cursor-not-allowed select-none ${
                        collapsed ? 'justify-center px-0' : 'px-3'
                      }`}
                      style={{ color: 'var(--sidebar-text-dim)' }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate flex-1">{label}</span>}
                      {!collapsed && <Lock className="h-3 w-3 flex-shrink-0" />}
                    </div>
                  );
                }

                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-3 rounded-xl py-2.5 text-[13px] transition-all duration-200 ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${active ? 'font-semibold' : 'hover:translate-x-0.5'}`}
                    style={{
                      borderLeft: collapsed ? 'none' : `2px solid ${active ? 'var(--sidebar-active-icon)' : 'transparent'}`,
                      color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                      background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                    }}
                  >
                    <Icon
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: active ? 'var(--sidebar-active-icon)' : 'var(--sidebar-text-dim)' }}
                    />
                    {!collapsed && <span className="truncate flex-1">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom section ── */}
      <div
        className={`mt-auto pb-3 space-y-3 ${collapsed ? 'px-1.5' : 'px-3'}`}
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        {/* Book a Demo */}
        <button
          onClick={openCalendly}
          title={collapsed ? 'Book a Demo' : undefined}
          className={`flex items-center justify-center gap-2 rounded-xl mt-3 text-[13px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
            collapsed ? 'mx-auto h-10 w-10 px-0' : 'w-full px-3 py-2.5'
          }`}
          style={{
            border: '1px solid var(--btn-secondary-border)',
            color: 'var(--text-secondary)',
            background: 'transparent',
          }}
        >
          <Calendar className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Book a Demo</span>}
        </button>

        {/* User info */}
        <div className={`flex items-center gap-2.5 rounded-lg py-2 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: '#3B82F6' }}
            title={collapsed ? email : undefined}
          >
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium" style={{ color: 'var(--sidebar-text)' }}>
                {email}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Log out"
              className="flex-shrink-0 rounded p-1 transition-colors"
              style={{ color: 'var(--sidebar-text-dim)' }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Collapsed: logout icon only */}
        {collapsed && (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Log out"
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--sidebar-text-dim)' }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
