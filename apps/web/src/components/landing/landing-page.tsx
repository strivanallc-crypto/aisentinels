'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Menu,
  X,
  Clock,
  DollarSign,
  FileStack,
  SearchX,
  Zap,
  FileText,
  ClipboardCheck,
  Wrench,
  Library,
  LayoutDashboard,
  Upload,
  Sparkles,
  GitMerge,
  BadgeCheck,
  Check,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { Qualy } from '@/components/sentinels/qualy';
import { Saffy } from '@/components/sentinels/saffy';
import { Envi } from '@/components/sentinels/envi';
import { Risko } from '@/components/sentinels/risko';
import { Doki } from '@/components/sentinels/doki';

/* ─── FAQ Data ────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: 'What ISO standards do you support?',
    a: 'AI Sentinels currently supports ISO 9001 (Quality), ISO 14001 (Environmental), ISO 27001 (Information Security), ISO 45001 (Occupational Health & Safety), and ISO 50001 (Energy Management). Our Unified Core Engine maps controls across all five standards simultaneously.',
  },
  {
    q: 'How is this different from hiring a consultant?',
    a: 'Traditional consultants charge $50K+ and take 12-18 months. AI Sentinels uses artificial intelligence to do 80% of the heavy lifting\u2014document transformation, gap analysis, control mapping\u2014so you get audit-ready faster at a fraction of the cost. You still get expert guidance, but the AI accelerates everything.',
  },
  {
    q: 'What does \u201cWrite Once, Comply Everywhere\u201d mean?',
    a: 'ISO standards share a common Annex SL harmonized structure. When you create a document in AI Sentinels, our engine automatically maps it to every applicable standard. One policy can satisfy requirements across ISO 9001, 14001, 27001, 45001, and 50001 simultaneously.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. AI Sentinels runs on AWS infrastructure with encryption at rest (AES-256 via KMS) and in transit (TLS 1.3). We use Aurora Serverless PostgreSQL with RDS Proxy, S3 Object Lock for compliance evidence, and follow SOC 2 architecture principles. Your data never leaves your dedicated tenant boundary.',
  },
  {
    q: 'Can I try before I buy?',
    a: 'Yes! We offer a 14-day free trial with full access to the platform. No credit card required. Start with Document Studio Solo or jump straight into the full Compliance Platform\u2014you can upgrade or downgrade at any time.',
  },
];

/* ─── Reusable Sub-components ─────────────────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ borderColor: 'var(--content-border)' }}
      className="border-b last:border-b-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold transition-colors hover:text-blue-600"
        style={{ color: open ? '#2563eb' : 'var(--content-text)' }}
      >
        {q}
        <ChevronDown
          size={20}
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: open ? '300px' : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <p
          className="pb-5 text-sm leading-relaxed"
          style={{ color: 'var(--content-text-muted)' }}
        >
          {a}
        </p>
      </div>
    </div>
  );
}

/* ─── Main Landing Page ───────────────────────────────────────────────────── */

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
      {/* ─── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md" style={{ borderColor: 'var(--content-border)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Shield size={28} className="text-blue-600" />
            <span className="text-xl font-bold" style={{ color: 'var(--content-text)' }}>AI Sentinels</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium transition-colors hover:text-blue-600" style={{ color: 'var(--content-text-muted)' }}>
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium transition-colors hover:text-blue-600" style={{ color: 'var(--content-text-muted)' }}>
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium transition-colors hover:text-blue-600" style={{ color: 'var(--content-text-muted)' }}>
              FAQ
            </a>
          </div>

          {/* Desktop Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--content-border)', color: 'var(--content-text)' }}
            >
              Log In
            </Link>
            <a
              href="#pricing"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--sentinel-blue)' }}
            >
              Book a Demo
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-white px-6 pb-6 pt-4 md:hidden" style={{ borderColor: 'var(--content-border)' }}>
            <div className="flex flex-col gap-4">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                Features
              </a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                Pricing
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                FAQ
              </a>
              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href="/login"
                  className="rounded-xl border py-2.5 text-center text-sm font-semibold"
                  style={{ borderColor: 'var(--content-border)', color: 'var(--content-text)' }}
                >
                  Log In
                </Link>
                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl py-2.5 text-center text-sm font-semibold text-white"
                  style={{ background: 'var(--sentinel-blue)' }}
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-20 md:flex-row md:py-28 lg:py-32">
          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
              ISO Certification in{' '}
              <span className="text-blue-400">90 Days</span>,{' '}
              <br className="hidden sm:block" />
              Not 18 Months
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-blue-100/80 md:mx-0">
              AI-powered compliance platform for manufacturing, construction, and energy.
              One system for ISO 9001, 14001, 27001, 45001, and 50001.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
              <a
                href="#pricing"
                className="w-full rounded-xl px-8 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 sm:w-auto"
                style={{ background: 'var(--sentinel-blue)' }}
              >
                Book Your Free Demo
              </a>
              <Link
                href="/login"
                className="w-full rounded-xl border border-white/20 px-8 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 md:justify-start">
              {['Multi-Standard', 'AI-Powered', 'Audit-Ready'].map((badge) => (
                <span key={badge} className="flex items-center gap-2 text-sm text-blue-200/70">
                  <Check size={16} className="text-blue-400" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Qualy Character */}
          <div className="flex shrink-0 items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-blue-500/10 blur-2xl" />
              <Qualy size={220} className="relative drop-shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROBLEM / SOLUTION ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28" style={{ background: 'var(--content-bg)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl" style={{ color: 'var(--content-text)' }}>
            The Old Way vs The AI Sentinels Way
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base" style={{ color: 'var(--content-text-muted)' }}>
            Traditional ISO certification is slow, expensive, and fragmented. We changed that.
          </p>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {/* Old Way */}
            <div className="rounded-2xl border bg-red-50/50 p-8" style={{ borderColor: '#fecaca' }}>
              <div className="mb-6 inline-block rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                The Old Way
              </div>
              <ul className="space-y-5">
                {[
                  { icon: Clock, text: '12\u201318 months to certification' },
                  { icon: DollarSign, text: '$50K+ in consultant fees' },
                  { icon: FileStack, text: '100+ separate documents to manage' },
                  { icon: SearchX, text: 'Manual gap analysis and control mapping' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-red-100 p-2">
                      <item.icon size={18} className="text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-red-900">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Sentinels Way */}
            <div className="rounded-2xl border bg-green-50/50 p-8" style={{ borderColor: '#bbf7d0' }}>
              <div className="mb-6 inline-block rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                The AI Sentinels Way
              </div>
              <ul className="space-y-5">
                {[
                  { icon: Zap, text: '90 days to audit-ready' },
                  { icon: DollarSign, text: 'Flat monthly fee, no surprises' },
                  { icon: FileText, text: 'Unified document system across all standards' },
                  { icon: Sparkles, text: 'AI-powered gap detection and remediation' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-green-100 p-2">
                      <item.icon size={18} className="text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-900">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ───────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl" style={{ color: 'var(--content-text)' }}>
            Everything You Need to Get Certified
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base" style={{ color: 'var(--content-text-muted)' }}>
            Six integrated modules that work together to streamline your entire compliance journey.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Zap,
                title: 'Unified Core Engine',
                desc: 'Write once, comply everywhere across 5 ISO standards.',
                color: '#2563eb',
                bg: '#eff6ff',
              },
              {
                icon: FileText,
                title: 'AI Document Studio',
                desc: 'Generate ISO-compliant documents in minutes, not weeks.',
                color: '#7c3aed',
                bg: '#f5f3ff',
              },
              {
                icon: ClipboardCheck,
                title: 'Smart Audit Room',
                desc: 'Mock audits that prepare you for the real thing.',
                color: '#059669',
                bg: '#ecfdf5',
              },
              {
                icon: Wrench,
                title: 'CAPA Engine',
                desc: 'Finding to resolution, tracked and verified automatically.',
                color: '#d97706',
                bg: '#fffbeb',
              },
              {
                icon: Library,
                title: 'Controls Library',
                desc: 'Map controls to standards automatically with AI.',
                color: '#dc2626',
                bg: '#fef2f2',
              },
              {
                icon: LayoutDashboard,
                title: 'Management Dashboard',
                desc: 'Real-time compliance visibility across all standards.',
                color: '#0891b2',
                bg: '#ecfeff',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
              >
                <div
                  className="mb-4 inline-flex rounded-xl p-3"
                  style={{ background: feature.bg }}
                >
                  <feature.icon size={24} style={{ color: feature.color }} />
                </div>
                <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--content-text-muted)' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28" style={{ background: 'var(--content-bg)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl" style={{ color: 'var(--content-text)' }}>
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base" style={{ color: 'var(--content-text-muted)' }}>
            Four simple steps from where you are today to audit-ready confidence.
          </p>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Upload, step: 1, title: 'Upload', desc: 'Upload your existing documents and policies.' },
              { icon: Sparkles, step: 2, title: 'Transform', desc: 'AI transforms them into ISO-compliant format.' },
              { icon: GitMerge, step: 3, title: 'Map', desc: 'Platform maps to all standards automatically.' },
              { icon: BadgeCheck, step: 4, title: 'Certify', desc: 'Pass your audit with confidence.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: 'var(--sentinel-blue)' }}>
                  {item.step}
                </div>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: '#eff6ff' }}>
                  <item.icon size={24} className="text-blue-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--content-text-muted)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl" style={{ color: 'var(--content-text)' }}>
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base" style={{ color: 'var(--content-text-muted)' }}>
            Start small and scale as you grow. All plans include a 14-day free trial.
          </p>

          {/* Certification Package Banner */}
          <div
            className="mx-auto mt-10 max-w-3xl rounded-2xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #1e40af)' }}
          >
            <p className="text-sm font-semibold text-blue-200">Certification Readiness Package</p>
            <p className="mt-1 text-2xl font-bold text-white">
              $15,000 <span className="text-base font-normal text-blue-200">one-time</span>
            </p>
            <p className="mt-2 text-sm text-blue-100/80">
              Audit-ready in 90 days or your money back. Includes dedicated implementation team.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {/* Tier 1 */}
            <div
              className="flex flex-col rounded-2xl border p-8"
              style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
            >
              <div className="mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
                  Document Studio Solo
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold" style={{ color: 'var(--content-text)' }}>$197</span>
                  <span className="text-sm" style={{ color: 'var(--content-text-muted)' }}>/month</span>
                </div>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {[
                  'AI Document Transformation (20 docs/mo)',
                  'Document Library (unlimited storage)',
                  'Single standard compliance mapping',
                  'Email support',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                    <Check size={16} className="mt-0.5 shrink-0 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="rounded-xl border py-3 text-center text-sm font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--content-border)', color: 'var(--content-text)' }}
              >
                Start Free Trial
              </Link>
            </div>

            {/* Tier 2 — Most Popular */}
            <div
              className="relative flex flex-col rounded-2xl border-2 p-8 shadow-xl"
              style={{ borderColor: '#2563eb' }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold text-white" style={{ background: 'var(--sentinel-blue)' }}>
                Most Popular
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
                  Compliance Platform
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold" style={{ color: 'var(--content-text)' }}>$497</span>
                  <span className="text-sm" style={{ color: 'var(--content-text-muted)' }}>/month</span>
                </div>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {[
                  'Everything in Document Studio Solo',
                  'Full Unified Core (all standards)',
                  'AI Mock Auditor (10 sessions/mo)',
                  'CAPA Management',
                  'Priority email support',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                    <Check size={16} className="mt-0.5 shrink-0 text-blue-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="rounded-xl py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--sentinel-blue)' }}
              >
                Start Free Trial
              </Link>
            </div>

            {/* Tier 3 */}
            <div
              className="flex flex-col rounded-2xl border p-8"
              style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
            >
              <div className="mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
                  Enterprise Suite
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold" style={{ color: 'var(--content-text)' }}>$997</span>
                  <span className="text-sm" style={{ color: 'var(--content-text-muted)' }}>/month</span>
                </div>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {[
                  'Everything in Compliance Platform',
                  'Energy Management + API integrations',
                  'Unlimited AI interactions',
                  'Predictive audit engine',
                  'Dedicated success manager',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                    <Check size={16} className="mt-0.5 shrink-0 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#pricing"
                className="rounded-xl border py-3 text-center text-sm font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--content-border)', color: 'var(--content-text)' }}
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-20 py-20 md:py-28" style={{ background: 'var(--content-bg)' }}>
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl" style={{ color: 'var(--content-text)' }}>
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base" style={{ color: 'var(--content-text-muted)' }}>
            Everything you need to know about AI Sentinels.
          </p>

          <div className="mt-12 rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: 'var(--content-border)' }}>
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Ready to Get Audit-Ready in 90 Days?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-blue-100/70">
            Join manufacturing, construction, and energy companies who trust AI Sentinels
            to simplify ISO compliance.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#pricing"
              className="w-full rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 sm:w-auto"
              style={{ background: 'var(--sentinel-blue)' }}
            >
              Book a Demo
            </a>
            <Link
              href="/login"
              className="w-full rounded-xl border border-white/20 px-8 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Sentinel Characters */}
          <div className="mt-14 flex items-end justify-center gap-4 md:gap-6">
            <Qualy size={52} className="opacity-90" />
            <Saffy size={52} className="opacity-90" />
            <Envi size={52} className="opacity-90" />
            <Risko size={52} className="opacity-90" />
            <Doki size={52} className="opacity-90" />
          </div>
          <p className="mt-4 text-xs text-blue-200/50">
            Meet your Sentinels: Qualy, Saffy, Envi, Risko & Doki
          </p>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t py-12" style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2.5">
            <Shield size={20} className="text-blue-600" />
            <span className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>AI Sentinels</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="text-xs transition-colors hover:text-blue-600" style={{ color: 'var(--content-text-muted)' }}>
              Privacy Policy
            </a>
            <a href="#" className="text-xs transition-colors hover:text-blue-600" style={{ color: 'var(--content-text-muted)' }}>
              Terms of Service
            </a>
            <a href="#" className="text-xs transition-colors hover:text-blue-600" style={{ color: 'var(--content-text-muted)' }}>
              Contact
            </a>
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--content-text-dim)' }}>
            <span className="flex items-center gap-1">
              <Lock size={12} />
              Secured by AWS
            </span>
            <span>\u00b7</span>
            <span>Multi-tenant EQMS</span>
          </div>
        </div>
        <p className="mt-6 text-center text-xs" style={{ color: 'var(--content-text-dim)' }}>
          &copy; 2026 AI Sentinels. All rights reserved.
        </p>
      </footer>

      {/* Smooth scroll CSS */}
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
