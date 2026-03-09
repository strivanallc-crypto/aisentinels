'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c2fa69] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-full max-w-sm bg-[#111111] border border-white/10 rounded-xl p-8 flex flex-col items-center gap-6">

        {/* Shield monogram + brand */}
        <div className="flex flex-col items-center gap-3">
          {/* Shield monogram */}
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1.5px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
              <path d="M14 0L28 6V16C28 23.732 21.732 30.928 14 32C6.268 30.928 0 23.732 0 16V6L14 0Z"
                    fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              <text x="14" y="22" textAnchor="middle"
                    fill="white" fontSize="13" fontWeight="700"
                    fontFamily="system-ui, sans-serif">S</text>
            </svg>
          </div>
          {/* Brand name */}
          <div className="text-center">
            <div className="text-white font-semibold text-lg tracking-tight">
              AI Sentinels
            </div>
            <div className="text-white/40 text-xs mt-0.5"
                 style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              ISO COMPLIANCE PLATFORM
            </div>
          </div>
        </div>

        {/* Sign-in button */}
        <button
          onClick={() => signIn('cognito', { callbackUrl: '/dashboard' })}
          className="w-full bg-[#c2fa69] hover:bg-[#d4fb85] text-[#0a0a0a]
                     font-semibold text-sm rounded-lg py-2.5 px-4
                     transition-colors duration-150 cursor-pointer"
        >
          Sign in with AWS Cognito
        </button>

        <p className="text-white/25 text-xs text-center"
           style={{ fontFamily: 'monospace' }}>
          Secured by Amazon Cognito · Multi-tenant IMS
        </p>
      </div>
    </div>
  );
}
