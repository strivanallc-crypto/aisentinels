'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';

// ── Plan data ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: 'enterprise' as const,
    name: 'Scale',
    price: 2497,
    sub: 'For multi-site or multi-standard operations',
    standards: 3,
    users: 25,
    credits: 500,
    featured: false,
  },
  {
    key: 'professional' as const,
    name: 'Professional',
    badge: 'MOST POPULAR',
    price: 1397,
    sub: 'For growing compliance teams',
    standards: 2,
    users: 10,
    credits: 200,
    featured: true,
  },
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 597,
    sub: 'For single-standard certification',
    standards: 1,
    users: 3,
    credits: 50,
    featured: false,
  },
];

const INDUSTRIES = [
  'Manufacturing',
  'Construction',
  'Food Production',
  'Energy',
  'Healthcare',
  'Logistics',
  'Other',
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// ── Component ───────────────────────────────────────────────────────────────
export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');

  const canContinue =
    fullName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    companyName.trim() &&
    industry;

  async function handleSelectPlan(plan: 'starter' | 'professional' | 'enterprise') {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/billing/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          companyName,
          email,
          password,
          industry,
          plan,
        }),
      });

      const data = await res.json() as { redirectUrl?: string; error?: string; warning?: string };

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-start py-12 px-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10 text-xs font-medium tracking-wide">
        <span className={step >= 1 ? 'text-[#c2fa69]' : 'text-white/30'}>1. Your Details</span>
        <ArrowRight size={12} className="text-white/20" />
        <span className={step >= 2 ? 'text-[#c2fa69]' : 'text-white/30'}>2. Choose Plan</span>
        <ArrowRight size={12} className="text-white/20" />
        <span className="text-white/30">3. Payment</span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1 — Your Details                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="w-full max-w-sm bg-[#111111] border border-white/10 rounded-xl p-8 flex flex-col items-center gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3">
            <div style={{
              width: 56, height: 56,
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
                <path d="M14 0L28 6V16C28 23.732 21.732 30.928 14 32C6.268 30.928 0 23.732 0 16V6L14 0Z"
                      fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                <text x="14" y="22" textAnchor="middle"
                      fill="white" fontSize="13" fontWeight="700"
                      fontFamily="system-ui, sans-serif">S</text>
              </svg>
            </div>
            <div className="text-center">
              <div className="text-white font-semibold text-lg tracking-tight">Create Your Account</div>
              <div className="text-white/40 text-xs mt-0.5" style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>
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

          {/* Form fields */}
          <div className="w-full space-y-3">
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-[#c2fa69]/50 transition-colors"
            />
            <input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-[#c2fa69]/50 transition-colors"
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-[#c2fa69]/50 transition-colors"
            />
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-[#c2fa69]/50 transition-colors"
            />
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-[#c2fa69]/50 transition-colors appearance-none cursor-pointer"
            >
              <option value="" disabled className="bg-[#111111] text-white/30">Industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind} className="bg-[#111111] text-white">{ind}</option>
              ))}
            </select>
          </div>

          {/* Continue button */}
          <button
            onClick={() => canContinue && setStep(2)}
            disabled={!canContinue}
            className="w-full bg-[#c2fa69] hover:bg-[#d4fb85] text-[#0a0a0a]
                       font-semibold text-sm rounded-lg py-2.5 px-4
                       transition-colors duration-150 cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            Continue <ArrowRight size={14} />
          </button>

          <p className="text-white/25 text-xs text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-[#c2fa69] hover:underline">Sign in</Link>
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2 — Choose Your Plan                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="w-full max-w-4xl">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-sm text-[#c2fa69] hover:text-[#d4fb85] mb-6 cursor-pointer transition-colors"
          >
            <ArrowLeft size={14} /> Back to details
          </button>

          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 font-heading">
            Choose Your Plan
          </h2>
          <p className="text-[#6b7280] text-sm text-center mb-8">
            All plans include Records Vault. No hidden fees.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-xl p-6 flex flex-col ${
                  plan.featured
                    ? 'bg-[#111111] border-2 border-[#c2fa69]/50'
                    : 'bg-[#111111] border border-white/10'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c2fa69] text-[#0a0a0a] text-[10px] font-bold tracking-wider px-3 py-1 rounded-full uppercase">
                    {plan.badge}
                  </div>
                )}

                <div className="text-white/60 text-xs uppercase tracking-wider mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">${plan.price}</span>
                  <span className="text-white/40 text-sm">/month</span>
                </div>
                <p className="text-white/40 text-xs mb-4">{plan.sub}</p>

                <div className="space-y-2 text-sm text-white/70 mb-6 flex-1">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#c2fa69]" />
                    {plan.standards} standard{plan.standards > 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#c2fa69]" />
                    {plan.users} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#c2fa69]" />
                    {plan.credits} AI credits/mo
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#c2fa69]" />
                    Document Studio (Doki)
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#c2fa69]" />
                    Audit Room (Audie)
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#c2fa69]" />
                    CAPA Engine (Nexus)
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.key)}
                  disabled={loading}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors duration-150 cursor-pointer
                    disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2 ${
                    plan.featured
                      ? 'bg-[#c2fa69] hover:bg-[#d4fb85] text-[#0a0a0a]'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Select Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
