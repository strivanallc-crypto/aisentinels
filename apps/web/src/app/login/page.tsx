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

        {/* Continue with Google */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full h-11 bg-white text-[#111111] font-medium text-sm
                     rounded-xl border border-black/[0.12] flex items-center
                     justify-center gap-3 hover:bg-gray-50 transition-colors
                     duration-150 cursor-pointer font-body"
        >
          {/* Google "G" multicolor SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Separator */}
        <div className="w-full flex items-center gap-3">
          <hr className="flex-1 border-white/10" />
          <span className="text-[#6b7280] text-sm">or</span>
          <hr className="flex-1 border-white/10" />
        </div>

        {/* Cognito sign-in button */}
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
