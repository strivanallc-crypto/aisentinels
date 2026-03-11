'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Zap, Sun, Moon } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { ToastProvider } from '@/components/ui/toast';
import { useTheme } from '@/components/theme-provider';
import { billingApi, api } from '@/lib/api';
import type { PlanType } from '@/lib/types';
import { hasAcceptedAllCurrentVersions } from '@/lib/legal-versions';

/* ── Route → readable label map ──────────────────────────────────────────── */
const ROUTE_LABELS: Record<string, string> = {
  dashboard:          'Dashboard',
  'document-studio':  'Document Studio',
  'ai-dashboard':     'AI Dashboard',
  audit:              'Audit Room',
  capa:               'CAPA Engine',
  risk:               'Risk Navigator',
  'compliance-matrix':'Compliance Matrix',
  'management-review':'Management Review',
  'records-vault':    'Records Vault',
  'board-report':     'Board Report',
  billing:            'Billing',
  settings:           'Settings',
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label:
      ROUTE_LABELS[seg] ??
      seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));
}

/* ── Loading screen ──────────────────────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: 'var(--content-bg)' }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Neon pulse loader */}
        <div className="relative">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <div
            className="absolute inset-0 rounded-full animate-neon-pulse"
            style={{ background: 'var(--accent)', opacity: 0.1 }}
          />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
          Loading...
        </p>
      </div>
    </div>
  );
}

/* ── Theme Toggle Button ─────────────────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <Sun
        className="h-4 w-4 absolute transition-all duration-300"
        style={{
          color: '#F59E0B',
          opacity: theme === 'light' ? 1 : 0,
          transform: theme === 'light' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
        }}
      />
      <Moon
        className="h-4 w-4 absolute transition-all duration-300"
        style={{
          color: '#818CF8',
          opacity: theme === 'dark' ? 1 : 0,
          transform: theme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)',
        }}
      />
    </button>
  );
}

/* ── Main layout client ──────────────────────────────────────────────────── */
export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  const [currentPlan, setCurrentPlan]           = useState<PlanType>('starter');
  const [legalChecked, setLegalChecked]         = useState(false);
  const [actionsRemaining, setActionsRemaining] = useState(50);
  const [actionsLimit, setActionsLimit]         = useState(50);
  const [userMenuOpen, setUserMenuOpen]         = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Fetch subscription plan
  useEffect(() => {
    billingApi
      .getSubscription()
      .then((res) => setCurrentPlan((res.data as { plan?: PlanType })?.plan ?? 'starter'))
      .catch(() => {});
  }, []);

  // Fetch usage stats
  useEffect(() => {
    billingApi
      .getUsage()
      .then((res) => {
        const d = res.data as { creditsRemaining?: number; aiCreditsLimit?: number } | null;
        if (d) {
          setActionsRemaining(d.creditsRemaining ?? 50);
          setActionsLimit(d.aiCreditsLimit ?? 50);
        }
      })
      .catch(() => {});
  }, []);

  // ── Legal acceptance gate (Phase 10) ──────────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;
    api
      .get('/api/v1/legal/status')
      .then((res) => {
        const data = res.data as { accepted: Array<{ documentType: string; version: string }> };
        if (!hasAcceptedAllCurrentVersions(data.accepted)) {
          router.replace('/onboarding/legal');
        } else {
          setLegalChecked(true);
        }
      })
      .catch(() => {
        // If legal check fails (e.g. 404 before deploy), allow through
        setLegalChecked(true);
      });
  }, [status, router]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (status === 'loading') return <LoadingScreen />;
  if (!session) return null;
  if (!legalChecked) return <LoadingScreen />;

  const breadcrumbs = buildBreadcrumbs(pathname);
  const email       = session.user?.email ?? '';
  const initial     = email.charAt(0).toUpperCase();

  return (
    <ToastProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: 'var(--content-bg)' }}
      >
        <Sidebar session={session} currentPlan={currentPlan} />
        <CommandPalette />

        <main className="flex flex-1 flex-col overflow-hidden">
          {/* ── Header bar ── */}
          <header
            className="flex items-center justify-between px-6 lg:px-8 py-3 flex-shrink-0"
            style={{
              borderBottom: '1px solid var(--content-border)',
              background: 'var(--content-bg)',
            }}
          >
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-[13px]">
              {breadcrumbs.map((bc, i) => (
                <Fragment key={bc.href}>
                  {i > 0 && (
                    <ChevronRight className="h-3 w-3" style={{ color: 'var(--muted)' }} />
                  )}
                  {bc.isLast ? (
                    <span className="font-medium" style={{ color: 'var(--text)' }}>
                      {bc.label}
                    </span>
                  ) : (
                    <Link
                      href={bc.href}
                      className="transition-colors"
                      style={{ color: 'var(--muted)' }}
                    >
                      {bc.label}
                    </Link>
                  )}
                </Fragment>
              ))}
            </nav>

            {/* Right side: theme toggle + usage badge + user avatar */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <ThemeToggle />

              {/* Actions remaining badge */}
              <div
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <Zap className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  AI Credits:
                </span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                  {actionsRemaining}/{actionsLimit}
                </span>
              </div>

              {/* User avatar + dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white transition-all hover:ring-2"
                  style={{
                    background: '#3B82F6',
                    outlineColor: 'var(--accent)',
                  }}
                  title={email}
                >
                  {initial}
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 top-10 z-50 w-56 rounded-xl py-1 animate-scale-in"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                      <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>
                        {email}
                      </p>
                      <p className="text-[11px] capitalize" style={{ color: 'var(--muted)' }}>
                        {currentPlan} plan
                      </p>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── Page content ── */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
