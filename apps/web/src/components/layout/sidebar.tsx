'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { LogOut, Shield, Lock, Calendar, PanelLeftClose, PanelLeft } from 'lucide-react';
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
      className={`flex flex-shrink-0 flex-col h-screen transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[240px]'
      }`}
      style={{ background: '#0a0a0a', borderRight: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-3 py-5 ${collapsed ? 'justify-center px-2' : 'px-5'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: '#3B82F6' }}
        >
          <Shield className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white leading-tight font-heading">
              AI Sentinels
            </p>
            <p className="text-[10px] leading-tight" style={{ color: '#4b5563' }}>
              ISO Compliance
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: '#4b5563' }}
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
          className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/5"
          style={{ color: '#4b5563' }}
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* ── Nav ── */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-5 ${collapsed ? 'px-1.5' : 'px-3'}`}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: '#4b5563' }}
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
                      className={`flex items-center gap-3 rounded-md py-2 text-[13px] opacity-40 cursor-not-allowed select-none ${
                        collapsed ? 'justify-center px-0' : 'px-3'
                      }`}
                      style={{ color: '#6b7280' }}
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
                    className={`flex items-center gap-3 rounded-md py-2 text-[13px] transition-colors ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${active ? 'font-medium' : 'hover:bg-white/5'}`}
                    style={{
                      borderLeft: collapsed ? 'none' : `2px solid ${active ? '#c2fa69' : 'transparent'}`,
                      color: active ? '#c2fa69' : '#9ca3af',
                      ...(active ? { background: 'rgba(194, 250, 105, 0.05)' } : {}),
                      ...(collapsed && active ? { background: 'rgba(194, 250, 105, 0.10)' } : {}),
                    }}
                  >
                    <Icon
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: active ? '#c2fa69' : '#6b7280' }}
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
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Book a Demo */}
        <button
          onClick={openCalendly}
          title={collapsed ? 'Book a Demo' : undefined}
          className={`flex items-center justify-center gap-2 rounded-md mt-3 text-[13px] font-medium transition-colors hover:bg-[rgba(194,250,105,0.1)] ${
            collapsed ? 'mx-auto h-10 w-10 px-0' : 'w-full px-3 py-2'
          }`}
          style={{
            border: '1px solid #c2fa69',
            color: '#c2fa69',
            background: 'transparent',
          }}
        >
          <Calendar className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Book a Demo</span>}
        </button>

        {/* User info */}
        <div className={`flex items-center gap-2.5 rounded-md py-2 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: '#3B82F6' }}
            title={collapsed ? email : undefined}
          >
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium" style={{ color: '#9ca3af' }}>
                {email}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Log out"
              className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/5"
              style={{ color: '#6b7280' }}
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
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/5"
            style={{ color: '#6b7280' }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
