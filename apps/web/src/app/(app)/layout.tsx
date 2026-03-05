'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { ToastProvider } from '@/components/ui/toast';

function LoadingScreen() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
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

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') return <LoadingScreen />;
  if (!session) return null;

  return (
    <ToastProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: 'var(--content-bg)' }}
      >
        <Sidebar session={session} />
        <CommandPalette />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
