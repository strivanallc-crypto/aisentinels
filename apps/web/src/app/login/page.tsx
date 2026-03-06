'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SentinelAvatar } from '@/components/SentinelAvatar';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--sidebar-bg)' }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
      <div
        className="w-full max-w-sm rounded-2xl px-10 py-10 shadow-2xl"
        style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
      >

        {/* Character + title */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <SentinelAvatar sentinelId="qualy" size={72} ring />
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--content-text)' }}>
              AI Sentinels
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--content-text-muted)' }}>
              ISO Compliance Platform
            </p>
          </div>
        </div>

        {/* Sign-in button */}
        <button
          onClick={() => signIn('cognito', { callbackUrl: '/dashboard' })}
          className="w-full rounded-xl py-3 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ background: 'var(--sentinel-blue)', focusRingColor: 'var(--sentinel-blue)' } as React.CSSProperties}
        >
          Sign in with AWS Cognito
        </button>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--content-text-dim)' }}>
          Secured by Amazon Cognito · Multi-tenant EQMS
        </p>
      </div>
    </div>
  );
}
