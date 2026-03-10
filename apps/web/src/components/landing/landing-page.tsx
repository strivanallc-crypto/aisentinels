'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, Check, Plus, Minus, ArrowRight, Star } from 'lucide-react';
import { SentinelShield } from '@/components/ui/sentinel-shield';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Data                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

type SentinelId = 'qualy' | 'envi' | 'saffy' | 'doki' | 'audie' | 'nexus';

const SENTINELS: { id: SentinelId; name: string; title: string; color: string }[] = [
  { id: 'qualy', name: 'Qualy', title: 'Quality (ISO 9001)', color: '#3B82F6' },
  { id: 'envi',  name: 'Envi',  title: 'Environmental (ISO 14001)', color: '#22C55E' },
  { id: 'saffy', name: 'Saffy', title: 'Safety (ISO 45001)', color: '#F59E0B' },
  { id: 'doki',  name: 'Doki',  title: 'Document Studio', color: '#6366F1' },
  { id: 'audie', name: 'Audie', title: 'Audit Room', color: '#F43F5E' },
  { id: 'nexus', name: 'Nexus', title: 'CAPA Engine', color: '#8B5CF6' },
];

const FEATURES = [
  {
    sentinel: 'doki' as SentinelId,
    headline: 'Draft ISO Documents in Minutes, Not Months',
    body: 'Doki generates audit-ready procedures, policies, and work instructions tailored to your industry and ISO standard \u2014 in one click.',
    bullets: ['Procedure templates', 'Policy generation', 'Auto-clause mapping', 'TipTap rich editor'],
    flip: false,
  },
  {
    sentinel: 'audie' as SentinelId,
    headline: 'Run Mock Audits Before the Real One',
    body: 'Audie conducts internal audits using ISO 19011 methodology \u2014 identifying gaps before your registrar does.',
    bullets: ['AI audit planning', 'Clause-by-clause examination', 'Finding classification', 'CAPA auto-generation'],
    flip: true,
  },
  {
    sentinel: 'nexus' as SentinelId,
    headline: 'Close Every Nonconformity With Root Cause AI',
    body: 'Nexus runs Ishikawa root cause analysis and tracks corrective actions to closure \u2014 automatically.',
    bullets: ['5-Why analysis', 'Ishikawa diagrams', 'Action tracking', 'Effectiveness verification'],
    flip: false,
  },
];

const TESTIMONIALS = [
  {
    quote: 'We achieved ISO 9001 certification in 11 weeks. The Document Studio alone saved us 40 hours.',
    author: 'Sarah K.',
    role: 'Quality Manager, Manufacturing',
  },
  {
    quote: 'Audie found 3 major gaps our consultant missed. Best investment we made before our surveillance audit.',
    author: 'James T.',
    role: 'HSE Director, Construction',
  },
  {
    quote: 'Running ISO 9001 and 14001 together used to mean double the work. With AI Sentinels it\u2019s one system.',
    author: 'Maria L.',
    role: 'Compliance Lead, Food Production',
  },
];

const PLANS = [
  {
    name: 'Scale',
    badge: null,
    monthly: 2497,
    annual: 1997,
    sub: 'For multi-site or multi-standard operations',
    standards: 3,
    users: 25,
    credits: 500,
    featured: false,
  },
  {
    name: 'Professional',
    badge: 'MOST POPULAR',
    monthly: 1397,
    annual: 1117,
    sub: 'For growing compliance teams',
    standards: 2,
    users: 10,
    credits: 200,
    featured: true,
  },
  {
    name: 'Starter',
    badge: null,
    monthly: 597,
    annual: 477,
    sub: 'For single-standard certification',
    standards: 1,
    users: 3,
    credits: 50,
    featured: false,
  },
];

const PLAN_FEATURES = [
  'Document Studio (Doki)',
  'Audit Room (Audie)',
  'CAPA Engine (Nexus)',
  'Records Vault',
  'Compliance Matrix',
  'Board Report Generator',
  'Email Notifications',
  'Priority Support',
];

const FAQ_ITEMS = [
  {
    q: 'How long does ISO certification take with AI Sentinels?',
    a: 'Most clients reach audit readiness in 60\u201390 days. Traditional consulting takes 12\u201318 months and costs $40,000\u2013$120,000.',
  },
  {
    q: 'Do I still need an ISO consultant?',
    a: 'No. Each sentinel knows every clause of its standard and applies ISO 19011 audit methodology automatically.',
  },
  {
    q: 'Which ISO standards are supported?',
    a: 'ISO 9001 (Quality), ISO 14001 (Environmental), and ISO 45001 (Occupational Health & Safety). All three share Annex SL structure.',
  },
  {
    q: 'Is our compliance data secure?',
    a: 'Yes. Multi-tenant isolation, JWT auth, row-level security, AWS infrastructure with full audit logging on every action.',
  },
  {
    q: "What if we don\u2019t pass our audit?",
    a: 'Audie reruns mock audits with updated evidence until every finding is closed. Zero open gaps before your registrar visit.',
  },
];

const LOGOS = [
  'ACME Manufacturing',
  'BuildRight Construction',
  'FreshCo Foods',
  'PowerGen Energy',
  'SafeWork Group',
  'QualityFirst Ltd',
];

/* ─────────────────────────────────────────────────────────────────────────── */
/* Hooks                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function useScrolledPast(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

function useFadeInRef() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('animate-fade-in-up'); observer.disconnect(); } },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Landing Page                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const scrolled = useScrolledPast(20);

  // Redirect logged-in users
  useEffect(() => { if (session) router.push('/dashboard'); }, [session, router]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white font-body">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* NAVBAR                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[var(--border)]' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
              <path
                d="M28 4L8 14v14c0 12.4 8.5 24 20 28 11.5-4 20-15.6 20-28V14L28 4z"
                fill="#c2fa69" fillOpacity="0.2" stroke="#c2fa69" strokeWidth="2.5" strokeLinejoin="round"
              />
              <text x="28" y="33" textAnchor="middle" dominantBaseline="central" fill="#c2fa69"
                fontSize="18" fontWeight="800" fontFamily="var(--font-heading, 'Syne')">S</text>
            </svg>
            <span className="font-heading font-bold text-lg text-white">AI Sentinels</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm text-[var(--muted)]">
            <button onClick={() => scrollTo('features')} className="hover:text-white transition-colors cursor-pointer">Platform</button>
            <button onClick={() => scrollTo('sentinels')} className="hover:text-white transition-colors cursor-pointer">Sentinels</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-white transition-colors cursor-pointer">Pricing</button>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-[var(--muted)] hover:text-white transition-colors">Log In</Link>
            <Link
              href="/signup"
              className="h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold inline-flex items-center hover:brightness-110 transition-all"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white cursor-pointer">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#0a0a0a]/98 backdrop-blur-md border-t border-[var(--border)] px-6 py-6 space-y-4">
            <button onClick={() => scrollTo('features')} className="block text-sm text-[var(--muted)] hover:text-white cursor-pointer">Platform</button>
            <button onClick={() => scrollTo('sentinels')} className="block text-sm text-[var(--muted)] hover:text-white cursor-pointer">Sentinels</button>
            <button onClick={() => scrollTo('pricing')} className="block text-sm text-[var(--muted)] hover:text-white cursor-pointer">Pricing</button>
            <Link href="/blog" className="block text-sm text-[var(--muted)] hover:text-white">Blog</Link>
            <div className="pt-4 border-t border-[var(--border)] space-y-3">
              <Link href="/login" className="block text-sm text-white">Log In</Link>
              <Link href="/signup" className="block h-10 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold flex items-center justify-center">
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Social proof */}
          <div className="flex items-center justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} fill="#c2fa69" stroke="#c2fa69" />
            ))}
            <span className="ml-2 text-xs text-[var(--muted)]">
              Trusted by compliance teams in manufacturing, construction & energy
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold tracking-tight leading-[1.05] mb-6">
            ISO Certification Shouldn&apos;t<br className="hidden md:block" /> Take 18 Months.
          </h1>

          {/* Sub */}
          <p className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Six AI Sentinels eliminate the paperwork, the guesswork, and the audit anxiety &mdash;
            delivering certification-ready compliance in a fraction of the time.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="h-12 px-8 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all"
            >
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.Calendly) {
                  window.Calendly.initPopupWidget({ url: 'https://calendly.com/julio-aisentinels' });
                }
              }}
              className="h-12 px-8 rounded-full border border-[var(--border)] text-white font-medium inline-flex items-center gap-2 hover:bg-white/5 transition-all cursor-pointer"
            >
              Book a Demo
            </button>
          </div>

          {/* Sentinel shields grid */}
          <div className="flex items-center justify-center gap-6 md:gap-10 mb-12">
            {SENTINELS.map((s, i) => (
              <div
                key={s.id}
                className="flex flex-col items-center gap-2 animate-float"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                <SentinelShield sentinel={s.id} size="lg" glow />
                <span className="text-xs text-[var(--muted)]">{s.name}</span>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--muted)] tracking-wider uppercase">
            <span>ISO 9001</span>
            <span className="text-[var(--border)]">|</span>
            <span>ISO 14001</span>
            <span className="text-[var(--border)]">|</span>
            <span>ISO 45001</span>
            <span className="text-[var(--border)]">|</span>
            <span>54 AI-Powered Routes</span>
            <span className="text-[var(--border)]">|</span>
            <span>100% Cloud-Native</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SOCIAL PROOF / LOGOS                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-12">
            When <span className="text-[var(--accent)]" style={{ color: '#65a30d' }}>compliance</span> matters,
            they choose AI Sentinels
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {LOGOS.map((name) => (
              <div
                key={name}
                className="w-40 h-16 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <span className="text-xs text-gray-500 font-medium tracking-wide">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FEATURES (alternating)                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div id="features">
        {FEATURES.map((feat, idx) => (
          <FeatureSection key={feat.sentinel} feature={feat} index={idx} />
        ))}

        {/* Feature 4 — IMS */}
        <ImsFeatureSection />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* COMPLIANCE HEATMAP PREVIEW                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <HeatmapSection />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TESTIMONIALS                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-[var(--bg)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--accent)]">Testimonials</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-4">
                Real results from<br />compliance teams
              </h2>
              <p className="text-[var(--muted)] mb-8">
                See how organizations are achieving ISO certification faster with AI Sentinels.
              </p>
              <Link
                href="/signup"
                className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all"
              >
                Join 50+ compliance teams <ArrowRight size={16} />
              </Link>
            </div>
            <div className="space-y-6">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.author}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                      {t.author.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.author}</p>
                      <p className="text-xs text-[var(--muted)] uppercase tracking-wider">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PRICING                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-500">Pricing Plans</span>
          <h2 className="text-4xl md:text-5xl font-bold text-[#0a0a0a] mt-3 mb-4">
            Choose Your Compliance Coverage
          </h2>
          <p className="text-gray-500 mb-8">All plans include Records Vault. No hidden fees.</p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${!annual ? 'bg-[#0a0a0a] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${annual ? 'bg-[#0a0a0a] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Yearly
            </button>
            {annual && <span className="text-xs text-green-600 font-semibold">Save 20%</span>}
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 text-left ${
                  plan.featured
                    ? 'bg-[#111111] text-white border-2 border-[var(--accent)] scale-[1.02]'
                    : 'bg-white text-[#0a0a0a] border border-gray-200'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-bold px-3 py-1 rounded-full tracking-wider">
                    {plan.badge}
                  </span>
                )}

                <p className={`text-xs font-semibold uppercase tracking-[0.15em] mb-4 ${plan.featured ? 'text-[var(--accent)]' : 'text-gray-500'}`}>
                  {plan.name}
                </p>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold">${annual ? plan.annual : plan.monthly}</span>
                  <span className={`text-sm ${plan.featured ? 'text-gray-400' : 'text-gray-500'}`}>/month</span>
                </div>
                <p className={`text-sm mb-8 ${plan.featured ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.sub}
                </p>

                <div className={`text-xs space-y-2 mb-8 ${plan.featured ? 'text-gray-300' : 'text-gray-600'}`}>
                  <p>{plan.standards} standard{plan.standards > 1 ? 's' : ''} &middot; {plan.users} users &middot; {plan.credits} AI credits/mo</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {PLAN_FEATURES.map((feat, i) => {
                    const included = plan.name === 'Scale' || (plan.name === 'Professional' && i < 7) || (plan.name === 'Starter' && i < 5);
                    return (
                      <li key={feat} className={`flex items-center gap-2 text-sm ${
                        included
                          ? plan.featured ? 'text-white' : 'text-[#0a0a0a]'
                          : plan.featured ? 'text-gray-600 line-through' : 'text-gray-400 line-through'
                      }`}>
                        <Check size={14} className={included ? (plan.featured ? 'text-[var(--accent)]' : 'text-green-600') : 'text-gray-400'} />
                        {feat}
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href="/signup"
                  className={`block w-full h-11 rounded-full text-sm font-semibold flex items-center justify-center transition-all ${
                    plan.featured
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110'
                      : 'bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Records Vault included in all plans &middot; Annual billing saves 20%
          </p>
          <p className="mt-3 text-xs text-gray-400 italic max-w-md mx-auto">
            Every week without a system is a week further from certification.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FAQ                                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-[var(--bg)]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--accent)]">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-white pr-4">{item.q}</span>
                  {openFaq === i ? <Minus size={16} className="shrink-0 text-[var(--accent)]" /> : <Plus size={16} className="shrink-0 text-[var(--muted)]" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-[var(--muted)] leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-[var(--accent)]">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--accent-fg)]">
              Ready to Transform Your Compliance?
            </h2>
            <p className="text-[var(--accent-fg)]/70 mt-2">
              Take the next step toward certification-ready compliance with six AI Sentinels.
            </p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 h-12 px-8 rounded-full bg-[var(--accent-fg)] text-white font-semibold inline-flex items-center gap-2 hover:bg-[#1a1a1a] transition-all"
          >
            Get started for free <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[var(--bg)] border-t border-[var(--border)] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
                  <path d="M28 4L8 14v14c0 12.4 8.5 24 20 28 11.5-4 20-15.6 20-28V14L28 4z"
                    fill="#c2fa69" fillOpacity="0.2" stroke="#c2fa69" strokeWidth="2.5" strokeLinejoin="round" />
                  <text x="28" y="33" textAnchor="middle" dominantBaseline="central" fill="#c2fa69"
                    fontSize="18" fontWeight="800" fontFamily="var(--font-heading, 'Syne')">S</text>
                </svg>
                <span className="font-heading font-bold text-white">AI Sentinels</span>
              </Link>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                ISO 9001 &middot; ISO 14001 &middot; ISO 45001<br />
                AI-powered compliance platform.
              </p>
            </div>

            {/* Links */}
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Platform</p>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li><button onClick={() => scrollTo('features')} className="hover:text-white transition-colors cursor-pointer">Features</button></li>
                <li><button onClick={() => scrollTo('pricing')} className="hover:text-white transition-colors cursor-pointer">Pricing</button></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Legal</p>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Connect</p>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li><a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LinkedIn</a></li>
                <li><a href="mailto:support@aisentinels.io" className="hover:text-white transition-colors">support@aisentinels.io</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[var(--muted)]">&copy; {new Date().getFullYear()} AI Sentinels LLC. All rights reserved.</p>
            <p className="text-xs text-[var(--muted)]">Built with AI &middot; Deployed on AWS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function FeatureSection({ feature, index }: { feature: typeof FEATURES[number]; index: number }) {
  const ref = useFadeInRef();
  const isWhite = index % 2 === 0;

  const textBlock = (
    <div className="space-y-6">
      <SentinelShield sentinel={feature.sentinel} size="lg" glow />
      <h3 className={`text-3xl md:text-4xl font-bold ${isWhite ? 'text-[#0a0a0a]' : 'text-white'}`}>
        {feature.headline}
      </h3>
      <p className={`text-base leading-relaxed ${isWhite ? 'text-gray-600' : 'text-gray-400'}`}>
        {feature.body}
      </p>
      <div className="flex flex-wrap gap-2">
        {feature.bullets.map((b) => (
          <span
            key={b}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide uppercase ${
              isWhite ? 'bg-gray-100 text-gray-700' : 'bg-white/10 text-gray-300'
            }`}
          >
            <Check size={12} /> {b}
          </span>
        ))}
      </div>
    </div>
  );

  const mockupBlock = (
    <div className={`rounded-2xl border overflow-hidden ${
      isWhite ? 'bg-[#111111] border-gray-200' : 'bg-[var(--surface)] border-[var(--border)]'
    }`}>
      <div className="aspect-[4/3] flex items-center justify-center p-8">
        <div className="w-full max-w-xs space-y-4">
          <div className="h-3 bg-white/10 rounded-full w-3/4" />
          <div className="h-3 bg-white/10 rounded-full w-full" />
          <div className="h-3 bg-white/10 rounded-full w-2/3" />
          <div className="h-24 bg-white/5 rounded-lg mt-6 flex items-center justify-center">
            <SentinelShield sentinel={feature.sentinel} size="lg" glow />
          </div>
          <div className="h-3 bg-white/10 rounded-full w-1/2" />
        </div>
      </div>
    </div>
  );

  return (
    <section className={`py-24 ${isWhite ? 'bg-white' : 'bg-[var(--bg)]'}`}>
      <div ref={ref} className="max-w-6xl mx-auto px-6 opacity-0">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {feature.flip ? (
            <>
              {mockupBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {mockupBlock}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ImsFeatureSection() {
  const ref = useFadeInRef();
  return (
    <section id="sentinels" className="py-24 bg-[var(--bg)]">
      <div ref={ref} className="max-w-6xl mx-auto px-6 opacity-0">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Mockup: 3 shields */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] aspect-[4/3] flex items-center justify-center gap-6">
            <SentinelShield sentinel="qualy" size="lg" glow />
            <SentinelShield sentinel="envi" size="lg" glow />
            <SentinelShield sentinel="saffy" size="lg" glow />
          </div>

          <div className="space-y-6">
            <div className="flex gap-3">
              <SentinelShield sentinel="qualy" size="md" />
              <SentinelShield sentinel="envi" size="md" />
              <SentinelShield sentinel="saffy" size="md" />
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-white">
              One Platform. Three ISO Standards. Zero Overlap.
            </h3>
            <p className="text-base text-gray-400 leading-relaxed">
              Annex SL means ISO 9001, 14001, and 45001 share 70% of their structure.
              AI Sentinels builds one Integrated Management System &mdash; eliminating duplicate work.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Shared org context', 'Unified document library', 'Cross-standard compliance matrix', 'IMS gap analysis'].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide uppercase bg-white/10 text-gray-300">
                  <Check size={12} /> {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeatmapSection() {
  const ref = useFadeInRef();
  const clauses = ['4.1', '4.2', '5.1', '5.2', '6.1', '6.2', '7.1', '7.2', '8.1', '8.2', '9.1', '9.2', '10.1', '10.2'];
  const standards = ['ISO 9001', 'ISO 14001', 'ISO 45001'];
  const statuses = ['bg-green-500', 'bg-green-500', 'bg-amber-500', 'bg-green-500', 'bg-red-500', 'bg-green-500'];

  return (
    <section className="py-24 bg-[var(--surface)]">
      <div ref={ref} className="max-w-5xl mx-auto px-6 text-center opacity-0">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">Your Compliance at a Glance</h2>
        <p className="text-[var(--muted)] mb-12">Real-time visibility across every ISO clause</p>

        {/* Heatmap grid */}
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${clauses.length}, 40px)` }}>
            {/* Header row */}
            <div />
            {clauses.map((c) => (
              <div key={c} className="text-[10px] text-[var(--muted)] text-center">{c}</div>
            ))}

            {/* Standard rows */}
            {standards.map((std, si) => (
              <>
                <div key={std} className="text-xs text-[var(--muted)] text-right pr-3 flex items-center justify-end">{std}</div>
                {clauses.map((c, ci) => {
                  const statusIndex = (si * 3 + ci) % statuses.length;
                  return (
                    <div
                      key={`${std}-${c}`}
                      className={`w-10 h-8 rounded ${statuses[statusIndex]} opacity-80`}
                    />
                  );
                })}
              </>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" /> Compliant</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Gap</span>
        </div>

        <Link
          href="/signup"
          className="mt-10 h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all"
        >
          See Your Real Score <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
