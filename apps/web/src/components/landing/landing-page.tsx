'use client';

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Menu,
  X,
  Check,
  ChevronDown,
  ArrowRight,
  Layers,
  ClipboardCheck,
  Wrench,
  Upload,
  Sparkles,
  GitMerge,
  BadgeCheck,
  Lock,
  Activity,
} from 'lucide-react';
import { Qualy } from '@/components/sentinels/qualy';
import { Saffy } from '@/components/sentinels/saffy';
import { Envi } from '@/components/sentinels/envi';
import { Risko } from '@/components/sentinels/risko';
import { Doki } from '@/components/sentinels/doki';

/* ─── Constants ───────────────────────────────────────────────────────────── */

const SENTINELS = [
  {
    name: 'Qualy',
    standard: 'ISO 9001',
    color: '#3b82f6',
    role: 'Quality Management Agent',
    Component: Qualy,
    capabilities: [
      'Document generation & control',
      'Process audit automation',
      'Customer satisfaction tracking',
    ],
  },
  {
    name: 'Envi',
    standard: 'ISO 14001',
    color: '#22c55e',
    role: 'Environmental Management Agent',
    Component: Envi,
    capabilities: [
      'Environmental impact assessment',
      'Waste management audit',
      'Regulatory compliance tracking',
    ],
  },
  {
    name: 'Saffy',
    standard: 'ISO 45001',
    color: '#f59e0b',
    role: 'Safety Management Agent',
    Component: Saffy,
    capabilities: [
      'Hazard identification & risk',
      'Incident tracking & reporting',
      'Safety audit automation',
    ],
  },
  {
    name: 'Risko',
    standard: 'ISO 27001',
    color: '#8b5cf6',
    role: 'Information Security Agent',
    Component: Risko,
    capabilities: [
      'Risk assessment & treatment',
      'Access control audit',
      'Data protection monitoring',
    ],
  },
  {
    name: 'Doki',
    standard: 'ISO 50001',
    color: '#06b6d4',
    role: 'Energy Management Agent',
    Component: Doki,
    capabilities: [
      'Energy baseline tracking',
      'EnPI calculation & reporting',
      'Consumption optimization',
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: 'What ISO standards do you support?',
    a: 'AI Sentinels supports ISO 9001 (Quality), ISO 14001 (Environmental), ISO 27001 (Information Security), ISO 45001 (Occupational Health & Safety), and ISO 50001 (Energy Management). Our Unified Core Engine maps controls across all five standards simultaneously.',
  },
  {
    q: 'How is this different from hiring a consultant?',
    a: 'Traditional consultants charge $50K+ and take 12\u201318 months. AI Sentinels deploys autonomous AI agents that handle 80% of the work\u2014document transformation, gap analysis, control mapping\u2014so you reach audit-readiness faster at a fraction of the cost.',
  },
  {
    q: 'What does \u201cWrite Once, Comply Everywhere\u201d mean?',
    a: 'ISO standards share a common Annex SL harmonized structure. When you create a document in AI Sentinels, our engine automatically maps it to every applicable standard. One policy can satisfy requirements across multiple ISO standards simultaneously.',
  },
  {
    q: 'Is my data secure?',
    a: 'AI Sentinels runs on AWS with encryption at rest (AES-256 via KMS) and in transit (TLS 1.3). We use Aurora Serverless PostgreSQL with RDS Proxy, S3 Object Lock for compliance evidence, and follow SOC 2 architecture principles. Your data never leaves your dedicated tenant boundary.',
  },
  {
    q: 'Can I try before I buy?',
    a: 'Yes. We offer a 14-day free trial with full platform access. No credit card required. Start with Compliance Starter or jump straight into Professional IMS\u2014upgrade or downgrade at any time.',
  },
];

const STATS = [
  '5 ISO Standards',
  '90-Day Certification',
  '66% Less Work',
  '24/7 AI Monitoring',
];

const INDUSTRIES = [
  'Manufacturing',
  'Construction',
  'Food & Beverage',
  'Energy',
  'Medical Devices',
  'Logistics',
];

/* ─── Hooks ───────────────────────────────────────────────────────────────── */

function useFadeIn(): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function FadeIn({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-gray-200 transition-colors hover:text-white"
      >
        {q}
        <ChevronDown
          size={18}
          className="shrink-0 text-gray-500 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '300px' : '0px', opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-sm leading-relaxed text-gray-400">{a}</p>
      </div>
    </div>
  );
}

/* ─── Main Landing Page ───────────────────────────────────────────────────── */

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 20);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: 'var(--font-inter, Inter, sans-serif)',
        background: '#070b18',
        color: '#e5e7eb',
      }}
    >
      {/* ─── NAVBAR ───────────────────────────────────────────────────── */}
      <nav
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(7,11,24,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Shield size={26} className="text-blue-500" />
            <span className="text-lg font-bold text-white">AI Sentinels</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {[
              ['Platform', '#platform'],
              ['Sentinels', '#sentinels'],
              ['Pricing', '#pricing'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-lg px-5 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
            >
              Log In
            </Link>
            <a
              href="#pricing"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-500"
            >
              Book a Demo
            </a>
          </div>

          <button
            className="text-gray-400 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            className="px-6 pb-6 pt-2 md:hidden"
            style={{ background: 'rgba(7,11,24,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex flex-col gap-4">
              {[
                ['Platform', '#platform'],
                ['Sentinels', '#sentinels'],
                ['Pricing', '#pricing'],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-gray-400"
                >
                  {label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-3">
                <Link
                  href="/login"
                  className="rounded-lg border border-white/10 py-2.5 text-center text-sm font-medium text-gray-300"
                >
                  Log In
                </Link>
                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen items-center overflow-hidden pt-20"
        style={{
          background: 'linear-gradient(145deg, #070b18 0%, #0c1529 40%, #111d3a 70%, #0a1022 100%)',
        }}
      >
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute right-0 top-1/4 h-[600px] w-[600px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />

        <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 py-20 md:flex-row lg:px-8">
          {/* Text — 60% */}
          <div className="flex-[3] text-center md:text-left">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-1.5">
              <Activity size={14} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-300">AI-Powered Compliance Platform</span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[64px]">
              Your AI Compliance Team.
              <br />
              <span className="text-gray-500">Always Audit-Ready.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-400 md:mx-0 md:text-xl">
              Five autonomous AI agents manage ISO 9001, 14001, 27001, 45001, and
              50001 — so you don&apos;t have to. One platform. Every standard.
              Certification in 90 days.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
              <a
                href="#pricing"
                className="w-full rounded-lg bg-blue-600 px-8 py-4 text-center text-sm font-semibold text-white transition-all hover:bg-blue-500 sm:w-auto"
              >
                Book a Demo
              </a>
              <Link
                href="/login"
                className="flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-medium text-gray-300 transition-colors hover:text-white sm:w-auto"
              >
                Start Free Trial
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Visual — 40% */}
          <div className="flex flex-[2] items-center justify-center">
            <div className="relative">
              <div
                className="absolute -inset-12 rounded-full opacity-30 blur-3xl"
                style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/sentinels-trio.png"
                alt=""
                width={480}
                height={480}
                className="relative hidden drop-shadow-2xl"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).classList.remove('hidden');
                  const fallback = (e.target as HTMLImageElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).classList.add('hidden');
                }}
              />
              {/* Fallback: sentinel SVGs */}
              <div className="relative flex items-end gap-3">
                <Saffy size={100} className="translate-y-2 opacity-90" />
                <Qualy size={140} className="opacity-100" />
                <Envi size={100} className="translate-y-2 opacity-90" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats ticker */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 overflow-x-auto px-6 py-4 md:gap-16">
            {STATS.map((stat) => (
              <span
                key={stat}
                className="shrink-0 text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {stat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF BAR ─────────────────────────────────────────── */}
      <section className="border-b border-white/5 py-14" style={{ background: '#080d1c' }}>
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <p className="mb-8 text-xs font-medium uppercase tracking-[0.2em] text-gray-600">
            Trusted by forward-thinking manufacturers
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {INDUSTRIES.map((ind) => (
              <span key={ind} className="text-sm font-medium text-gray-600">
                {ind}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MEET YOUR SENTINELS ──────────────────────────────────────── */}
      <section
        id="sentinels"
        className="scroll-mt-20 py-24 md:py-32"
        style={{ background: '#0a0f1e' }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="text-center">
            <h2 className="text-3xl font-bold text-white md:text-5xl">
              Meet Your Autonomous Compliance Team
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400 md:text-lg">
              Each Sentinel is an AI agent specialized in one ISO standard. They work
              24/7 — auditing, generating documents, tracking compliance, and alerting
              you to risks before auditors find them.
            </p>
          </FadeIn>

          {/* Sentinel cards — horizontal scroll on mobile */}
          <div className="mt-16 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:overflow-visible">
            {SENTINELS.map((s, i) => (
              <FadeIn
                key={s.name}
                delay={i * 0.08}
                className="w-[260px] shrink-0 snap-center md:w-auto"
              >
                <div
                  className="group flex h-full flex-col rounded-2xl border border-white/5 p-6 transition-all duration-300 hover:border-white/10"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderTopColor: s.color,
                    borderTopWidth: '2px',
                  }}
                >
                  <div className="mb-4">
                    <s.Component size={48} />
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: s.color }}>
                    {s.name}
                  </h3>
                  <span
                    className="mt-1 inline-block self-start rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color: s.color,
                      background: `${s.color}15`,
                      border: `1px solid ${s.color}30`,
                    }}
                  >
                    {s.standard}
                  </span>
                  <p className="mt-3 text-sm text-gray-400">{s.role}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {s.capabilities.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-2 text-xs leading-relaxed text-gray-500"
                      >
                        <Check size={12} className="mt-0.5 shrink-0" style={{ color: s.color }} />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-[11px] font-medium text-gray-600">Active 24/7</span>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3} className="mt-10 text-center">
            <p className="text-sm font-medium tracking-wide text-gray-600">
              Always on. Always compliant.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ─── PLATFORM SECTION ─────────────────────────────────────────── */}
      <section
        id="platform"
        className="scroll-mt-20 py-24 md:py-32"
        style={{ background: '#070b18' }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="text-center">
            <h2 className="text-3xl font-bold text-white md:text-5xl">
              One Platform. Every Standard.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400 md:text-lg">
              Write once, comply everywhere. Our Annex SL harmonized engine means one
              document satisfies multiple standards simultaneously.
            </p>
          </FadeIn>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Layers,
                title: 'Unified Core Engine',
                desc: 'One control maps to ISO 9001, 14001, and 45001 at once. Save 66% of documentation effort.',
              },
              {
                icon: ClipboardCheck,
                title: 'AI Audit Room',
                desc: 'Mock audits that mimic real registrar scrutiny. Know your score before the auditor arrives.',
              },
              {
                icon: Wrench,
                title: 'CAPA Intelligence',
                desc: 'From finding to resolution. AI tracks root causes, assigns actions, and verifies closure.',
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.1}>
                <div className="group flex h-full flex-col rounded-2xl border border-white/5 p-8 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.02]">
                  <div className="mb-5 inline-flex rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <f.icon size={24} className="text-blue-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#0a0f1e' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="text-center">
            <h2 className="text-3xl font-bold text-white md:text-5xl">How It Works</h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-gray-400 md:text-lg">
              Four steps from where you are today to audit-ready confidence.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Connector line (desktop) */}
              <div className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block" />

              {[
                { icon: Upload, step: 1, title: 'Upload', desc: 'Your existing documents and policies' },
                { icon: Sparkles, step: 2, title: 'AI Transforms', desc: 'Sentinels convert to ISO-compliant format' },
                { icon: GitMerge, step: 3, title: 'Auto-Map', desc: 'One document satisfies multiple standards' },
                { icon: BadgeCheck, step: 4, title: 'Get Certified', desc: 'Pass your audit with confidence' },
              ].map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="relative z-10 mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-blue-600/10 text-lg font-bold text-blue-400">
                    {item.step}
                  </div>
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
                    <item.icon size={22} className="text-gray-500" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── PRICING ──────────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 py-24 md:py-32" style={{ background: '#070b18' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="text-center">
            <h2 className="text-3xl font-bold text-white md:text-5xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-gray-400 md:text-lg">
              Start small and scale as you grow. All plans include a 14-day free trial.
            </p>
          </FadeIn>

          {/* Certification banner */}
          <FadeIn delay={0.1}>
            <div
              className="mx-auto mt-12 max-w-3xl rounded-2xl border border-blue-500/20 p-6 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(30,58,95,0.4), rgba(30,64,175,0.15))' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Certification Readiness Package
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                $15,000{' '}
                <span className="text-base font-normal text-gray-400">one-time</span>
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Audit-ready in 90 days or your money back
              </p>
            </div>
          </FadeIn>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {/* Tier 1 — Starter */}
            <FadeIn delay={0.1}>
              <div className="flex h-full flex-col rounded-2xl border border-white/5 p-8">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Compliance Starter</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$497</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {[
                    'AI Document Generation (30 docs/mo)',
                    'Single ISO standard',
                    '1 AI Sentinel active',
                    'Email support',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <Check size={15} className="mt-0.5 shrink-0 text-gray-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="rounded-lg border border-white/10 py-3 text-center text-sm font-semibold text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </FadeIn>

            {/* Tier 2 — Professional (Most Popular) */}
            <FadeIn delay={0.2}>
              <div
                className="relative flex h-full flex-col rounded-2xl border-2 border-blue-500/30 p-8"
                style={{
                  background: 'rgba(59,130,246,0.03)',
                  boxShadow: '0 0 60px -12px rgba(59,130,246,0.15)',
                }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Most Popular
                </div>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Professional IMS</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$997</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {[
                    'Everything in Starter',
                    'Up to 3 ISO standards simultaneously',
                    '3 AI Sentinels active',
                    'AI Mock Auditor (10 sessions/mo)',
                    'CAPA Management',
                    'Priority support',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check size={15} className="mt-0.5 shrink-0 text-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-blue-500"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </FadeIn>

            {/* Tier 3 — Enterprise */}
            <FadeIn delay={0.3}>
              <div className="flex h-full flex-col rounded-2xl border border-white/5 p-8">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Enterprise Command</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$2,497</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {[
                    'Everything in Professional',
                    'All 5 ISO standards + unlimited',
                    'All 5 AI Sentinels active',
                    'Unlimited AI interactions',
                    'Predictive audit engine',
                    'Dedicated success manager',
                    'API access + integrations',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <Check size={15} className="mt-0.5 shrink-0 text-gray-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#pricing"
                  className="rounded-lg border border-white/10 py-3 text-center text-sm font-semibold text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  Contact Sales
                </a>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#0a0f1e' }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <FadeIn className="text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Frequently Asked Questions
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-2 md:px-8">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────────────── */}
      <section
        className="py-24 md:py-32"
        style={{
          background: 'linear-gradient(145deg, #0c1529 0%, #111d3a 50%, #0a1022 100%)',
        }}
      >
        <FadeIn className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold text-white md:text-5xl">
            Ready to deploy your AI compliance team?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-gray-400 md:text-lg">
            Join forward-thinking manufacturers and engineers who trust AI Sentinels
            to simplify ISO compliance.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#pricing"
              className="w-full rounded-lg bg-blue-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-blue-500 sm:w-auto"
            >
              Book a Demo
            </a>
            <Link
              href="/login"
              className="w-full rounded-lg border border-white/10 px-8 py-4 text-center text-sm font-semibold text-gray-300 transition-colors hover:border-white/20 hover:text-white sm:w-auto"
            >
              Start Free Trial
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-600">
            No credit card required &middot; 14-day free trial &middot; Cancel anytime
          </p>
        </FadeIn>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────────── */}
      <footer
        className="border-t border-white/5 py-16"
        style={{ background: '#070b18' }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 md:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <Shield size={22} className="text-blue-500" />
                <span className="text-base font-bold text-white">AI Sentinels</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                AI-powered integrated management system for ISO compliance.
              </p>
            </div>

            {/* Platform */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Platform</p>
              <ul className="space-y-2.5">
                {['Features', 'Pricing', 'Sentinels'].map((link) => (
                  <li key={link}>
                    <a
                      href={`#${link.toLowerCase()}`}
                      className="text-sm text-gray-500 transition-colors hover:text-gray-300"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Company</p>
              <ul className="space-y-2.5">
                {['About', 'Contact', 'Blog'].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Legal</p>
              <ul className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service'].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
            <p className="text-xs text-gray-600">
              &copy; 2026 AI Sentinels. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Lock size={12} />
              <span>Secured by AWS</span>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
