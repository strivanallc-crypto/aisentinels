'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function SignupConfirmedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#111111] border border-white/10 rounded-xl p-8 flex flex-col items-center gap-6 text-center">
        {/* Success icon */}
        <div className="w-16 h-16 rounded-full bg-[#c2fa69]/10 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#c2fa69]" />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-xl font-bold text-white mb-2 font-heading">
            Payment Received
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            We&apos;re setting up your account. You&apos;ll receive a confirmation email within a few minutes.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="w-full bg-[#c2fa69] hover:bg-[#d4fb85] text-[#0a0a0a]
                     font-semibold text-sm rounded-lg py-2.5 px-4
                     transition-colors duration-150 text-center inline-block"
        >
          Go to Login &rarr;
        </Link>

        <p className="text-white/25 text-xs" style={{ fontFamily: 'monospace' }}>
          Secured by Amazon Cognito &middot; Wise Business API
        </p>
      </div>
    </div>
  );
}
