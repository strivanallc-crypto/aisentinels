'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { ToastProvider } from '@/components/ui/toast';
import { billingApi } from '@/lib/api';
import type { PlanType } from '@/lib/types';

function LoadingScreen() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm" style={{ color: 'var(--sidebar-text-dim)' }}>
          Loading…
        </p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<PlanType>('starter');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    billingApi
      .getSubscription()
      .then((res) => setCurrentPlan((res.data as { plan?: PlanType })?.plan ?? 'starter'))
      .catch(() => {});
  }, []);

  if (status === 'loading') return <LoadingScreen />;
  if (!session) return null;

  return (
    <ToastProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: 'var(--content-bg)' }}
      >
        <Sidebar session={session} currentPlan={currentPlan} />
        <CommandPalette />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
