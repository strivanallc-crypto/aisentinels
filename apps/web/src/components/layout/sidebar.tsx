'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { LogOut, Shield, ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from './nav-items';
import { Qualy } from '@/components/sentinels/qualy';

interface SidebarProps {
  session: Session;
}

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const email   = session.user?.email ?? '';
  const initial = email.charAt(0).toUpperCase();

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
        <Qualy size={22} className="flex-shrink-0 opacity-75" />
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

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
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
              <Icon
                className="h-4 w-4 flex-shrink-0"
                style={{
                  color: active ? 'var(--sidebar-active-icon)' : 'var(--sidebar-text-muted)',
                }}
              />
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
