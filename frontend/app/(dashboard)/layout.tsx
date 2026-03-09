'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, FileText, Archive, Bot, Wrench,
  AlertTriangle, ClipboardCheck, BookOpen, LogOut, Shield, ChevronRight,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',         label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/document-studio',   label: 'Document Studio', icon: FileText },
  { href: '/records-vault',     label: 'Records Vault',   icon: Archive },
  { href: '/ai-dashboard',      label: 'AI Sentinels',    icon: Bot },
  { href: '/capa',              label: 'CAPA Hub',        icon: Wrench },
  { href: '/risk',              label: 'Risk Navigator',  icon: AlertTriangle },
  { href: '/audit',             label: 'Audit Command',   icon: ClipboardCheck },
  { href: '/management-review', label: 'Mgmt Review',     icon: BookOpen },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#0f1117' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const email   = session.user?.email ?? '';
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8fafc' }}>
      {/* ── Sidebar ── */}
      <aside className="flex w-[220px] flex-shrink-0 flex-col" style={{ background: '#0f1117', borderRight: '1px solid #1e2130' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1e2130' }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#2563eb' }}>
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">AI Sentinels</p>
            <p className="text-[10px] leading-tight" style={{ color: '#4b5563' }}>ISO Compliance</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-all"
                style={active
                  ? { background: 'rgba(37,99,235,0.12)', color: '#60a5fa', fontWeight: 500 }
                  : { color: '#6b7280' }
                }
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280'; } }}
              >
                <Icon className="h-4 w-4 flex-shrink-0" style={{ color: active ? '#60a5fa' : '#4b5563' }} />
                <span className="truncate flex-1">{label}</span>
                {active && <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: '#3b82f6', opacity: 0.5 }} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3" style={{ borderTop: '1px solid #1e2130' }}>
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium" style={{ color: '#9ca3af' }}>{email}</p>
              <p className="text-[10px]" style={{ color: '#4b5563' }}>Admin</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Sign out"
              className="flex-shrink-0 rounded p-1 transition-colors"
              style={{ color: '#4b5563' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#4b5563'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
