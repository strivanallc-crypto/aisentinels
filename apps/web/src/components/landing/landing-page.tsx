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
  Plus,
  Minus,
  ArrowRight,
  GitMerge,
  GitPullRequest,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Zap,
  BarChart2,
  Lock,
  Leaf,
  FileText,
  ClipboardCheck,
} from 'lucide-react';

/* ─── Data ────────────────────────────────────────────────────────────────── */

const SENTINELS = [
  { name: 'Qualy', color: '#3B82F6', Icon: CheckCircle2 },
  { name: 'Envi',  color: '#22C55E', Icon: Leaf          },
  { name: 'Saffy', color: '#F59E0B', Icon: ShieldCheck   },
  { name: 'Doki',  color: '#6366F1', Icon: FileText       },
  { name: 'Audie', color: '#F43F5E', Icon: ClipboardCheck },
  { name: 'Nexus', color: '#8B5CF6', Icon: GitMerge       },
];

const COMPARISON_ROWS: [string, string][] = [
  ['$200/hr ISO consultant',         'AI agents included in plan'],
  ['12–18 months to certification',  'Audit-ready in 90 days'],
  ['Documents in spreadsheets',      'Auto-generated document library'],
  ['Manual audit preparation',       'Audie runs mock audits 24/7'],
  ['One standard at a time',         'ISO 9001 + 14001 + 45001 together'],
  ['Reactive gap discovery',         'Proactive gap detection'],
  ['No continuous monitoring',       'Real-time compliance scoring'],
  ['Lost CAPA threads',              'Nexus tracks every CAPA'],
];

const CHECK_COLORS = ['#3B82F6','#22C55E','#F59E0B','#6366F1','#F43F5E','#8B5CF6','#3B82F6','#22C55E'];

/** Category color map — light theme (landing page) */
const LANDING_CATEGORY_COLORS: Record<string, string> = {
  '2026 Updates': '#F43F5E',
  'Triple Credit': '#F97316',
  Engineering: '#8B5CF6',
  'AI + ISO': '#3B82F6',
  Records: '#22C55E',
};

/** Minimal blog post shape for landing page */
interface LandingBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readingTime: number;
}

const FAQ_ITEMS = [
  {
    q: 'How long does ISO certification take with AI Sentinels?',
    a: 'Most clients reach audit readiness in 60–90 days. Traditional ISO consulting takes 12–18 months and costs $40,000–$120,000. Our AI works 24/7.',
  },
  {
    q: 'Do I still need an ISO consultant?',
    a: 'No. AI Sentinels replaces the consultant function. Each sentinel knows every clause of its standard and applies ISO 19011 audit methodology automatically.',
  },
  {
    q: 'Which ISO standards are supported?',
    a: 'ISO 9001 (Quality), ISO 14001 (Environmental), and ISO 45001 (Occupational Health & Safety). All three share the Annex SL structure, which is why our IMS approach saves you significant time.',
  },
  {
    q: 'Is our compliance data secure?',
    a: 'Yes. Multi-tenant data isolation, JWT authentication, row-level security policies, and AWS infrastructure with full audit logging on every action.',
  },
  {
    q: "What if we don't pass our audit?",
    a: 'Audie reruns the mock audit with updated evidence until every finding is closed. You walk into your registrar audit with zero open gaps.',
  },
];

const PLAN_DATA = [
  {
    name: 'Starter',
    monthly: 597,
    annual: 477,
    annualSaving: 1440,
    subtitle: 'First ISO standard, fully automated',
    cta: 'Start Free Trial',
    ctaHref: '/login',
    popular: false,
    features: [
      { text: '1 ISO Standard (9001, 14001, or 45001)', ok: true  },
      { text: '3 Users',                                ok: true  },
      { text: '50 AI Credits/month',                   ok: true  },
      { text: 'Document Studio (Doki)',                 ok: true  },
      { text: 'Records Vault',                          ok: true  },
      { text: 'Audit Room (Audie)',                     ok: false },
      { text: 'CAPA Engine (Nexus)',                    ok: false },
      { text: 'Compliance Matrix',                      ok: false },
    ],
  },
  {
    name: 'Professional',
    monthly: 1397,
    annual: 1117,
    annualSaving: 3360,
    subtitle: 'Full IMS across two standards',
    cta: 'Get Started',
    ctaHref: '/login',
    popular: true,
    features: [
      { text: '2 ISO Standards',         ok: true },
      { text: '10 Users',                ok: true },
      { text: '200 AI Credits/month',    ok: true },
      { text: 'All 6 Sentinels',         ok: true },
      { text: 'Full Audit Room (Audie)', ok: true },
      { text: 'CAPA Engine (Nexus)',     ok: true },
      { text: 'Compliance Matrix',       ok: true },
      { text: 'Records Vault',           ok: true },
      { text: 'Priority Support',        ok: true },
    ],
  },
  {
    name: 'Scale',
    monthly: 2497,
    annual: 1997,
    annualSaving: 6000,
    subtitle: 'Enterprise IMS, three standards',
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@aisentinels.io',
    popular: false,
    features: [
      { text: '3 ISO Standards',              ok: true },
      { text: '25 Users',                     ok: true },
      { text: '500 AI Credits/month',         ok: true },
      { text: 'Everything in Professional',   ok: true },
      { text: 'Multi-site support',           ok: true },
      { text: 'White-label option',           ok: true },
      { text: 'Dedicated CSM',                ok: true },
      { text: 'SLA guarantee',                ok: true },
    ],
  },
];

/* ─── Hooks & helpers ─────────────────────────────────────────────────────── */

function useFadeIn(): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          obs.unobserve(el);
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
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
        transform: 'translateY(18px)',
        transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-medium text-gray-900">{q}</span>
        {open ? (
          <Minus size={18} className="mt-0.5 shrink-0 text-gray-400" />
        ) : (
          <Plus size={18} className="mt-0.5 shrink-0 text-gray-400" />
        )}
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '400px' : '0', opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-base leading-relaxed text-gray-500">{a}</p>
      </div>
    </div>
  );
}

/* ─── LandingPage ─────────────────────────────────────────────────────────── */

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  const onScroll = useCallback(() => setScrolled(window.scrollY > 8), []);
  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  // Fetch latest blog posts for §12B
  const [latestPosts, setLatestPosts] = useState<LandingBlogPost[]>([]);
  useEffect(() => {
    fetch('/api/ghost/posts?limit=3')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: LandingBlogPost[]) => setLatestPosts(data))
      .catch(() => setLatestPosts([]));
  }, []);

  const TABS = [
    {
      label: 'Sentinel Dashboard',
      color: '#3B82F6',
      h3: 'Unified Compliance Dashboard',
      body: 'Monitor all six sentinels in real-time. Compliance scores, active CAPAs, document status, and audit readiness — all in one view. Know your ISO posture at a glance.',
      pills: ['Live Compliance Score', 'Sentinel Status', 'Gap Alerts'],
      pillBg: '#EFF6FF', pillText: '#3B82F6',
    },
    {
      label: 'Document Studio',
      color: '#6366F1',
      h3: 'AI Document Generation',
      body: 'Doki generates ISO-compliant policies, procedures, and work instructions in minutes. Every document is version-controlled, cross-referenced, and mapped to the right clause.',
      pills: ['Auto-Generated', 'Version Control', 'Clause Mapping'],
      pillBg: '#EEF2FF', pillText: '#6366F1',
    },
    {
      label: 'Audit Room',
      color: '#F43F5E',
      h3: 'Mock Audit Intelligence',
      body: 'Audie runs ISO 19011-compliant mock audits before your registrar arrives. It finds gaps, requests evidence, and produces a full audit report — so there are no surprises.',
      pills: ['ISO 19011', 'Gap Analysis', 'Evidence Collection'],
      pillBg: '#FFF1F2', pillText: '#F43F5E',
    },
  ];

  const tab = TABS[activeTab]!;

  return (
    <div
      style={{
        fontFamily: 'var(--font-inter, Inter, sans-serif)',
        background: '#FFFFFF',
        color: '#0A0A0A',
        overflowX: 'hidden',
      }}
    >

      {/* ── §1 ANNOUNCEMENT BAR ─────────────────────────────────────────── */}
      <div
        className="py-2 text-center"
        style={{
          background: '#F0FDF4',
          borderBottom: '1px solid #BBF7D0',
        }}
      >
        <span style={{ fontSize: '13px', color: '#15803D' }}>
          ✦&nbsp;&nbsp;AI Sentinels now supports Integrated Management Systems
          — ISO 9001 + 14001 + 45001 in one platform&nbsp;&nbsp;→
        </span>
      </div>

      {/* ── §2 NAV ──────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 transition-all duration-200"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.96)' : '#ffffff',
          borderBottom: '1px solid #F3F4F6',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Shield size={22} className="text-blue-500" />
            <span className="text-base font-bold tracking-tight" style={{ color: '#0A0A0A' }}>
              AI Sentinels
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {[
              ['Platform', '#platform'],
              ['Sentinels', '#sentinels'],
              ['Pricing', '#pricing'],
              ['Blog', '/blog'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-sm transition-colors"
                style={{ color: '#6B7280' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0A0A0A')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
              style={{ borderColor: '#E5E7EB', color: '#0A0A0A' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Log In
            </Link>
            <a
              href="#pricing"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ background: '#0A0A0A' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1F2937')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0A0A0A')}
            >
              Book a Demo
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="text-gray-600 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="border-t px-6 pb-6 pt-4 md:hidden"
            style={{ borderColor: '#F3F4F6' }}
          >
            <div className="flex flex-col gap-4">
              {[
                ['Platform', '#platform'],
                ['Sentinels', '#sentinels'],
                ['Pricing', '#pricing'],
                ['Blog', '/blog'],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-gray-600"
                >
                  {label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2.5">
                <Link
                  href="/login"
                  className="rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-800"
                >
                  Log In
                </Link>
                <a
                  href="#pricing"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-gray-900 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── §3 HERO ─────────────────────────────────────────────────────── */}
      <section className="bg-white px-6 pb-0 pt-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center rounded-full border px-4 py-1.5" style={{ borderColor: '#E5E7EB' }}>
            <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
              🛡&nbsp; AI-Powered ISO Compliance Platform
            </span>
          </div>

          {/* H1 */}
          <h1
            className="font-bold text-gray-900"
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            Say Goodbye to Consultants.
            <br />
            Let AI Run Your ISO Compliance.
          </h1>

          {/* Subtext */}
          <p
            className="mx-auto mt-5 max-w-2xl leading-relaxed"
            style={{ fontSize: '18px', color: '#6B7280', lineHeight: '1.7' }}
          >
            Six specialized AI agents automate documents, audits, risk assessments, and
            CAPAs across ISO 9001, 14001, and 45001 — so your team focuses on operations,
            not paperwork.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-colors sm:w-auto"
              style={{ background: '#0A0A0A' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1F2937')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0A0A0A')}
            >
              Get Started Free
            </Link>
            <a
              href="#pricing"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border px-7 py-3.5 text-sm font-medium transition-colors sm:w-auto"
              style={{ borderColor: '#E5E7EB', color: '#0A0A0A' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Book a Demo <ArrowRight size={14} />
            </a>
          </div>

          {/* Social proof line */}
          <p className="mt-5 text-xs" style={{ color: '#9CA3AF' }}>
            ★★★★★&nbsp; Trusted by 500+ compliance professionals across manufacturing,
            construction, and food &amp; beverage
          </p>
        </div>

        {/* Hero visual — dark dashboard mockup */}
        <div className="mx-auto mt-14 max-w-5xl">
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              border: '1px solid #E5E7EB',
              boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
            }}
          >
            {/* Dark container */}
            <div style={{ background: '#0F1117', padding: '16px' }}>
              {/* Top bar */}
              <div
                className="mb-3 flex items-center justify-between rounded-xl px-4"
                style={{ background: '#1A1F2E', height: '40px' }}
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} color="white" />
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                    AI Sentinels
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {['#EF4444', '#F59E0B', '#22C55E'].map((c) => (
                    <div
                      key={c}
                      style={{ width: '12px', height: '12px', borderRadius: '50%', background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* App layout */}
              <div className="flex gap-3" style={{ height: '360px' }}>
                {/* Sidebar */}
                <div
                  className="hidden flex-shrink-0 rounded-xl p-4 sm:block"
                  style={{ background: '#111827', width: '160px' }}
                >
                  <div
                    className="mb-4 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#4B5563' }}
                  >
                    Sentinels
                  </div>
                  {SENTINELS.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                      style={{ marginBottom: '2px' }}
                    >
                      <div
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: s.color, flexShrink: 0,
                        }}
                      />
                      <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{s.name}</span>
                    </div>
                  ))}
                </div>

                {/* Main area */}
                <div className="relative flex-1 rounded-xl p-4" style={{ background: '#0F1117' }}>
                  {/* KPI row */}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    {[
                      { v: '94%',  l: 'Compliance Score', c: '#22C55E' },
                      { v: '12',   l: 'Open CAPAs',       c: '#F59E0B' },
                      { v: '3/3',  l: 'Standards Active', c: '#3B82F6' },
                    ].map((k) => (
                      <div
                        key={k.l}
                        className="rounded-xl p-3"
                        style={{ background: '#1A1F2E' }}
                      >
                        <div style={{ color: k.c, fontSize: '20px', fontWeight: 700 }}>{k.v}</div>
                        <div style={{ color: '#9CA3AF', fontSize: '10px', marginTop: '2px' }}>{k.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Compliance ring */}
                  <div className="flex items-center justify-center" style={{ height: '180px' }}>
                    <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                      <div
                        style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: 'conic-gradient(#22C55E 0deg 338.4deg, #1F2937 338.4deg 360deg)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute', inset: '14px', borderRadius: '50%',
                          background: '#0F1117', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexDirection: 'column',
                        }}
                      >
                        <span style={{ color: 'white', fontSize: '22px', fontWeight: 700 }}>94%</span>
                        <span style={{ color: '#9CA3AF', fontSize: '9px' }}>Compliance</span>
                      </div>
                    </div>
                  </div>

                  {/* Floating card — top right */}
                  <div
                    style={{
                      position: 'absolute', top: '16px', right: '16px',
                      background: 'white', borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                      padding: '10px 14px', width: '180px',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E' }} />
                      <span style={{ color: '#0A0A0A', fontSize: '12px', fontWeight: 600 }}>
                        Envi: Audit Ready
                      </span>
                    </div>
                  </div>

                  {/* Floating card — bottom left */}
                  <div
                    style={{
                      position: 'absolute', bottom: '16px', left: '16px',
                      background: 'white', borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                      padding: '10px 14px', width: '200px',
                    }}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F43F5E' }} />
                      <span style={{ color: '#0A0A0A', fontSize: '12px', fontWeight: 600 }}>
                        Audie: 2 gaps found
                      </span>
                    </div>
                    <div style={{ color: '#6B7280', fontSize: '11px', paddingLeft: '16px' }}>
                      ISO 9001 cl. 8.4
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── §4 SOCIAL PROOF BAR ─────────────────────────────────────────── */}
      <section
        id="sentinels"
        className="scroll-mt-20 py-10"
        style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="mx-auto max-w-5xl px-6 text-center lg:px-8">
          <p className="mb-6 text-sm" style={{ color: '#6B7280' }}>
            When compliance matters, they choose AI Sentinels
          </p>
          {[
            ['Manufacturing', 'Construction', 'Food & Beverage', 'Energy', 'Healthcare'],
            ['Logistics', 'Medical Devices', 'Automotive', 'Pharma', 'Oil & Gas'],
          ].map((row, ri) => (
            <div key={ri} className="mb-3 flex flex-wrap items-center justify-center gap-3 last:mb-0">
              {row.map((ind) => (
                <span
                  key={ind}
                  className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium"
                  style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                >
                  {ind}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── §5 FEATURES (tabbed) ────────────────────────────────────────── */}
      <section
        id="platform"
        className="scroll-mt-20 bg-white py-24 md:py-32"
      >
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <FadeIn className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              FEATURES
            </p>
            <h2
              className="font-semibold"
              style={{
                fontSize: 'clamp(26px,3.5vw,42px)',
                letterSpacing: '-0.02em',
                color: '#0A0A0A',
              }}
            >
              All Your Compliance, One Platform
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#6B7280' }}>
              No more juggling consultants, spreadsheets, and audit binders. One platform,
              six agents, three ISO standards.
            </p>
          </FadeIn>

          {/* Tabs */}
          <div
            className="mb-10 flex gap-8 overflow-x-auto"
            style={{ borderBottom: '1px solid #E5E7EB' }}
          >
            {TABS.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setActiveTab(i)}
                className="shrink-0 pb-3 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === i ? '#0A0A0A' : '#6B7280',
                  borderBottom: activeTab === i ? `2px solid ${t.color}` : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* Left: text */}
            <div>
              <h3
                className="mb-4 text-2xl font-semibold"
                style={{ color: '#0A0A0A', letterSpacing: '-0.01em' }}
              >
                {tab.h3}
              </h3>
              <p className="mb-6 text-base leading-relaxed" style={{ color: '#6B7280' }}>
                {tab.body}
              </p>
              <div className="flex flex-wrap gap-2">
                {tab.pills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: tab.pillBg, color: tab.pillText }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: dark card visual */}
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: '#0F1117',
                padding: '20px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                minHeight: '280px',
              }}
            >
              {/* Tab 0 — Dashboard mini */}
              {activeTab === 0 && (
                <div>
                  <div
                    className="mb-3 flex items-center justify-between rounded-xl px-3"
                    style={{ background: '#1A1F2E', height: '34px' }}
                  >
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>
                      AI Sentinels
                    </span>
                    <div className="flex gap-1">
                      {['#EF4444', '#F59E0B', '#22C55E'].map((c) => (
                        <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                      { v: '94%', l: 'Score',  c: '#22C55E' },
                      { v: '12',  l: 'CAPAs',  c: '#F59E0B' },
                      { v: '3/3', l: 'Active', c: '#3B82F6' },
                    ].map((k) => (
                      <div key={k.l} className="rounded-xl p-3" style={{ background: '#1A1F2E' }}>
                        <div style={{ color: k.c, fontSize: '18px', fontWeight: 700 }}>{k.v}</div>
                        <div style={{ color: '#9CA3AF', fontSize: '9px' }}>{k.l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SENTINELS.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                        style={{ background: '#1A1F2E' }}
                      >
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
                        <span style={{ color: '#D1D5DB', fontSize: '10px' }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl p-3" style={{ background: '#1A1F2E' }}>
                    <div style={{ color: '#4B5563', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                      Live Activity
                    </div>
                    {[
                      { t: 'Qualy: Quality Manual v2.3 generated', c: '#3B82F6', age: '2m' },
                      { t: 'Audie: mock audit complete — 94%',      c: '#F43F5E', age: '1h' },
                    ].map((item) => (
                      <div key={item.t} className="mb-1.5 flex items-center gap-2">
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.c, flexShrink: 0 }} />
                        <span style={{ color: '#9CA3AF', fontSize: '10px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.t}</span>
                        <span style={{ color: '#4B5563', fontSize: '9px', flexShrink: 0 }}>{item.age}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 1 — Document Studio */}
              {activeTab === 1 && (
                <div className="flex gap-3" style={{ height: '260px' }}>
                  {/* File tree */}
                  <div className="flex-shrink-0 rounded-xl p-3" style={{ background: '#111827', width: '140px' }}>
                    <div style={{ color: '#4B5563', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
                      Documents
                    </div>
                    {[
                      { name: 'Quality Manual', type: 'folder' },
                      { name: 'Procedures',     type: 'folder' },
                      { name: 'QP-001 Policy',  type: 'file', active: true },
                      { name: 'QP-002 Review',  type: 'file' },
                      { name: 'WI-001 Induction', type: 'file' },
                    ].map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                        style={{
                          background: (f as { active?: boolean }).active ? 'rgba(99,102,241,0.15)' : 'transparent',
                          marginBottom: '1px',
                        }}
                      >
                        <span style={{ fontSize: '10px' }}>
                          {f.type === 'folder' ? '📁' : '📄'}
                        </span>
                        <span
                          style={{
                            color: (f as { active?: boolean }).active ? '#818CF8' : '#6B7280',
                            fontSize: '10px',
                            fontWeight: (f as { active?: boolean }).active ? 600 : 400,
                          }}
                        >
                          {f.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Editor */}
                  <div className="flex-1 overflow-hidden rounded-xl p-4" style={{ background: '#1A1F2E' }}>
                    <div className="mb-3 border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                        Quality Policy v2.3
                      </div>
                      <div className="mt-1.5 flex gap-2">
                        <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', fontSize: '9px', padding: '2px 7px', borderRadius: '4px' }}>
                          ISO 9001 cl. 5.2
                        </span>
                        <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', fontSize: '9px', padding: '2px 7px', borderRadius: '4px' }}>
                          v2.3
                        </span>
                      </div>
                    </div>
                    {[80, 100, 90, 70, 95, 60, 85].map((w, i) => (
                      <div
                        key={i}
                        style={{ height: '7px', background: '#2D3748', borderRadius: '4px', width: `${w}%`, marginBottom: '8px' }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2 — Audit Room */}
              {activeTab === 2 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                      Audit Findings
                    </span>
                    <span style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', fontSize: '10px', padding: '2px 10px', borderRadius: '20px', fontWeight: 600 }}>
                      12 items
                    </span>
                  </div>
                  {[
                    { id: 1, sev: 'MAJOR', clause: 'ISO 9001 cl. 8.5.1', desc: 'No procedure for product release',     status: 'OPEN',     sc: '#F43F5E', sevBg: 'rgba(244,63,94,0.15)' },
                    { id: 2, sev: 'MINOR', clause: 'ISO 9001 cl. 9.1.1', desc: 'Monitoring frequency insufficient',    status: 'EVIDENCE', sc: '#F59E0B', sevBg: 'rgba(245,158,11,0.15)' },
                    { id: 3, sev: 'OBS',   clause: 'ISO 14001 cl. 6.1.2', desc: 'Aspects register incomplete',         status: 'CLOSED',   sc: '#22C55E', sevBg: 'rgba(107,114,128,0.15)' },
                    { id: 4, sev: 'OBS',   clause: 'ISO 45001 cl. 8.1.2', desc: 'Competency records missing',          status: 'CLOSED',   sc: '#22C55E', sevBg: 'rgba(107,114,128,0.15)' },
                  ].map((f) => (
                    <div
                      key={f.id}
                      className="mb-2 flex items-center gap-2 rounded-xl p-3"
                      style={{ background: '#1A1F2E' }}
                    >
                      <span style={{ color: '#4B5563', fontSize: '10px', width: '12px', flexShrink: 0 }}>{f.id}</span>
                      <span style={{ background: f.sevBg, color: f.sc, fontSize: '8px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', flexShrink: 0 }}>
                        {f.sev}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#9CA3AF', fontSize: '9px' }}>{f.clause}</div>
                        <div style={{ color: '#D1D5DB', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.desc}</div>
                      </div>
                      <span style={{ background: `${f.sc}18`, color: f.sc, fontSize: '8px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── §6 MORE FEATURES (3-col) ────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#F9FAFB' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <FadeIn className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              MORE FEATURES
            </p>
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
            >
              Go Beyond Basic Compliance
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#6B7280' }}>
              Every tool you need to build, maintain, and defend a world-class management system.
            </p>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                Icon: GitMerge,
                color: '#8B5CF6',
                pillBg: '#F5F3FF',
                title: 'Write Once, Comply Everywhere',
                body: 'Annex SL means one document satisfies ISO 9001, 14001, and 45001 simultaneously. Our AI maps every control automatically.',
                pills: ['Triple ISO Credit', 'Zero Duplication', 'Unified Audit Trail'],
              },
              {
                Icon: GitPullRequest,
                color: '#8B5CF6',
                pillBg: '#F5F3FF',
                title: 'Automated CAPA Management',
                body: 'Nexus tracks every corrective action from root cause to verification. Never lose a CAPA thread again.',
                pills: ['Root Cause Analysis', 'Verification Loop', 'Trend Detection'],
              },
              {
                Icon: ShieldAlert,
                color: '#F59E0B',
                pillBg: '#FFFBEB',
                title: 'AI Risk Assessment',
                body: 'Saffy identifies operational hazards, scores risk levels, and maps controls — before your auditor finds them first.',
                pills: ['ISO 45001', 'Hazard Mapping', 'Risk Scoring'],
              },
            ].map((card, i) => (
              <FadeIn key={card.title} delay={i * 0.08}>
                <div
                  className="flex h-full flex-col rounded-2xl bg-white p-8"
                  style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
                >
                  <div className="mb-5">
                    <card.Icon size={32} style={{ color: card.color }} />
                  </div>
                  <h3
                    className="mb-3 text-lg font-semibold"
                    style={{ color: '#0A0A0A', letterSpacing: '-0.01em' }}
                  >
                    {card.title}
                  </h3>
                  <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                    {card.body}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.pills.map((pill) => (
                      <span
                        key={pill}
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{ background: card.pillBg, color: card.color }}
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── §7 STATS ROW ────────────────────────────────────────────────── */}
      <section
        className="py-16"
        style={{ background: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            {[
              { num: '90', unit: 'Days', desc: 'Average time to audit readiness', color: '#3B82F6' },
              { num: '6',  unit: '',     desc: 'Specialized AI agents',           color: '#22C55E' },
              { num: '3',  unit: '',     desc: 'ISO standards in one platform',   color: '#F59E0B' },
              { num: '500+', unit: '',   desc: 'Compliance professionals trust us', color: '#6366F1' },
            ].map((stat, i) => (
              <FadeIn key={stat.desc} delay={i * 0.08} className="text-center">
                <div className="mb-1 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold" style={{ color: stat.color }}>
                    {stat.num}
                  </span>
                  {stat.unit && (
                    <span className="text-xl font-semibold text-gray-500">{stat.unit}</span>
                  )}
                </div>
                <p className="text-sm leading-snug" style={{ color: '#6B7280' }}>
                  {stat.desc}
                </p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── §8 BENEFITS GRID (2×3) ──────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#F9FAFB' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <FadeIn className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              BENEFITS
            </p>
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
            >
              Why Compliance Teams Choose AI Sentinels
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                Icon: CheckCircle2, color: '#3B82F6',
                title: 'No More Consultant Fees',
                body: 'Replace $200/hr ISO consultants with AI agents that work 24/7 and never miss a clause.',
              },
              {
                Icon: Zap, color: '#6366F1',
                title: '10x Faster Document Generation',
                body: 'Doki generates a full ISO policy library in hours, not the weeks a consultant would take.',
              },
              {
                Icon: ShieldCheck, color: '#F59E0B',
                title: 'Audit-Ready, Always',
                body: 'Audie runs continuous mock audits so you\'re never caught off-guard by your registrar.',
              },
              {
                Icon: GitMerge, color: '#8B5CF6',
                title: 'One System, Three Standards',
                body: 'Annex SL alignment means your IMS satisfies ISO 9001, 14001, and 45001 from a single framework.',
              },
              {
                Icon: BarChart2, color: '#22C55E',
                title: 'Real-Time Compliance Visibility',
                body: 'Live dashboards show compliance scores, open gaps, and sentinel activity — updated continuously.',
              },
              {
                Icon: Lock, color: '#F43F5E',
                title: 'Enterprise-Grade Security',
                body: 'Multi-tenant isolation, JWT auth, and AWS infrastructure with full audit logging.',
              },
            ].map((b, i) => (
              <FadeIn key={b.title} delay={i * 0.06}>
                <div
                  className="flex h-full flex-col rounded-2xl bg-white p-6"
                  style={{ border: '1px solid #E5E7EB' }}
                >
                  <div className="mb-4">
                    <b.Icon size={24} style={{ color: b.color }} />
                  </div>
                  <h3 className="mb-2 text-base font-semibold" style={{ color: '#0A0A0A' }}>
                    {b.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                    {b.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── §9 OLD VS NEW ───────────────────────────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <FadeIn className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              LEVEL UP
            </p>
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
            >
              Old Way vs. AI Sentinels
            </h2>
          </FadeIn>

          <FadeIn>
            <div className="overflow-x-auto">
              <div style={{ minWidth: '540px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                {/* Header */}
                <div className="grid grid-cols-2">
                  <div
                    className="border-r px-6 py-4"
                    style={{ background: '#F9FAFB', borderColor: '#E5E7EB' }}
                  >
                    <span className="text-sm font-semibold" style={{ color: '#6B7280' }}>
                      Traditional Way
                    </span>
                  </div>
                  <div className="px-6 py-4" style={{ background: '#0A0A0A' }}>
                    <span className="text-sm font-semibold text-white">AI Sentinels</span>
                  </div>
                </div>

                {/* Rows */}
                {COMPARISON_ROWS.map(([old, newVal], i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2"
                    style={{ borderTop: '1px solid #E5E7EB' }}
                  >
                    <div
                      className="flex items-center gap-3 border-r px-6 py-4"
                      style={{ borderColor: '#E5E7EB' }}
                    >
                      <X size={14} className="shrink-0" style={{ color: '#D1D5DB' }} />
                      <span className="text-sm" style={{ color: '#6B7280' }}>{old}</span>
                    </div>
                    <div className="flex items-center gap-3 px-6 py-4">
                      <Check
                        size={14}
                        className="shrink-0"
                        style={{ color: CHECK_COLORS[i % CHECK_COLORS.length] }}
                      />
                      <span className="text-sm font-medium" style={{ color: '#0A0A0A' }}>{newVal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/login"
                className="inline-block rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-colors"
                style={{ background: '#0A0A0A' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1F2937')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#0A0A0A')}
              >
                Get Started Free
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── §10 TESTIMONIALS ────────────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#F9FAFB' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <FadeIn className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              TESTIMONIALS
            </p>
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
            >
              Real Stories from Compliance Teams
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#6B7280' }}>
              See how teams across physical industries are passing audits with AI Sentinels.
            </p>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                quote:
                  'We used to spend 6 months preparing for our ISO 9001 surveillance audit. With AI Sentinels, Audie ran a full mock audit in two days and flagged every gap before our registrar arrived. We passed first time.',
                name: 'Marcus Reinholt',
                role: 'Quality Manager, Precision Parts GmbH',
                initials: 'MR',
                avatarBg: '#EFF6FF',
                avatarText: '#3B82F6',
              },
              {
                quote:
                  'The Write Once, Comply Everywhere approach is real. Our ISO 9001 context document automatically mapped to our 14001 program. We saved three months of consultant time on the second standard alone.',
                name: 'Sofia Andrade',
                role: 'EHS Director, Construção Verde S.A.',
                initials: 'SA',
                avatarBg: '#F0FDF4',
                avatarText: '#22C55E',
              },
              {
                quote:
                  'Doki generated our entire ISO 45001 procedure library in a weekend. What would have cost us $40,000 in consulting fees was done by the AI in 48 hours. The documents are better structured than anything we had before.',
                name: 'James Okafor',
                role: 'HSE Manager, Atlantic Food Processing Ltd.',
                initials: 'JO',
                avatarBg: '#FFF7ED',
                avatarText: '#F59E0B',
              },
            ].map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.08}>
                <div
                  className="flex h-full flex-col rounded-2xl bg-white p-6"
                  style={{
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="mb-3" style={{ color: '#F59E0B', fontSize: '14px' }}>
                    ★★★★★
                  </div>
                  <p className="flex-1 text-sm leading-relaxed" style={{ color: '#374151' }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: t.avatarBg, color: t.avatarText }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#0A0A0A' }}>
                        {t.name}
                      </div>
                      <div className="text-xs" style={{ color: '#9CA3AF' }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── §11 PRICING ─────────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 bg-white py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <FadeIn className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              PRICING
            </p>
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
            >
              Choose the Right Plan
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-base" style={{ color: '#6B7280' }}>
              No consultants. No surprises. Cancel anytime.
            </p>
          </FadeIn>

          {/* Annual toggle */}
          <FadeIn delay={0.1} className="mb-10 flex items-center justify-center gap-3">
            <span className="text-sm" style={{ color: annual ? '#9CA3AF' : '#0A0A0A', fontWeight: annual ? 400 : 500 }}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative h-6 w-11 rounded-full transition-colors duration-200"
              style={{ background: annual ? '#0A0A0A' : '#E5E7EB' }}
              aria-label="Toggle annual billing"
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: annual ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </button>
            <span className="text-sm" style={{ color: annual ? '#0A0A0A' : '#9CA3AF', fontWeight: annual ? 500 : 400 }}>
              Annual{' '}
              <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold" style={{ background: '#F0FDF4', color: '#16A34A' }}>
                Save 20%
              </span>
            </span>
          </FadeIn>

          <div className="grid gap-6 lg:grid-cols-3">
            {PLAN_DATA.map((plan, i) => {
              const price = annual ? plan.annual : plan.monthly;
              return (
                <FadeIn key={plan.name} delay={i * 0.08}>
                  <div
                    className="relative flex h-full flex-col rounded-2xl p-8"
                    style={{
                      background: 'white',
                      border: plan.popular ? '2px solid #0A0A0A' : '1px solid #E5E7EB',
                      boxShadow: plan.popular ? '0 8px 32px rgba(0,0,0,0.1)' : '0 4px 24px rgba(0,0,0,0.04)',
                    }}
                  >
                    {plan.popular && (
                      <div
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                        style={{ background: '#0A0A0A' }}
                      >
                        Most Popular
                      </div>
                    )}

                    <h3 className="text-base font-semibold" style={{ color: '#0A0A0A' }}>
                      {plan.name}
                    </h3>
                    <p className="mt-0.5 text-xs" style={{ color: '#9CA3AF' }}>{plan.subtitle}</p>

                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="text-4xl font-bold" style={{ color: '#0A0A0A' }}>
                        ${price.toLocaleString()}
                      </span>
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>/mo</span>
                    </div>

                    {annual && (
                      <p className="mt-1 text-xs font-medium" style={{ color: '#22C55E' }}>
                        Save ${plan.annualSaving.toLocaleString()}/yr
                      </p>
                    )}

                    <div className="my-6 h-px" style={{ background: '#E5E7EB' }} />

                    <ul className="flex-1 space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f.text} className="flex items-start gap-2.5">
                          {f.ok ? (
                            <Check size={15} className="mt-0.5 shrink-0" style={{ color: '#22C55E' }} />
                          ) : (
                            <X size={15} className="mt-0.5 shrink-0" style={{ color: '#D1D5DB' }} />
                          )}
                          <span
                            className="text-sm"
                            style={{ color: f.ok ? '#374151' : '#9CA3AF' }}
                          >
                            {f.text}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href={plan.ctaHref}
                      className="mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors"
                      style={
                        plan.popular
                          ? { background: '#0A0A0A', color: 'white' }
                          : { border: '1px solid #E5E7EB', color: '#0A0A0A' }
                      }
                      onMouseEnter={(e) => {
                        if (plan.popular) {
                          e.currentTarget.style.background = '#1F2937';
                        } else {
                          e.currentTarget.style.background = '#F9FAFB';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (plan.popular) {
                          e.currentTarget.style.background = '#0A0A0A';
                        } else {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {plan.cta}
                    </a>
                  </div>
                </FadeIn>
              );
            })}
          </div>

          <FadeIn delay={0.3} className="mt-8 text-center">
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              Records Vault included in all plans. No unlimited anything — costs are predictable.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── §12 FAQ ─────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#F9FAFB' }}>
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <FadeIn className="mb-12 text-center">
            <h2
              className="font-semibold"
              style={{ fontSize: 'clamp(26px,3.5vw,42px)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
            >
              Common Questions
            </h2>
          </FadeIn>
          <FadeIn delay={0.08}>
            <div className="rounded-2xl bg-white px-6 py-2 md:px-8" style={{ border: '1px solid #E5E7EB' }}>
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── §12B LATEST INSIGHTS ──────────────────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p
                  className="mb-2 text-sm font-semibold uppercase tracking-wider"
                  style={{ color: '#3B82F6' }}
                >
                  Blog
                </p>
                <h2
                  className="font-bold"
                  style={{
                    fontSize: 'clamp(28px,4vw,44px)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    color: '#0A0A0A',
                  }}
                >
                  Latest Insights
                </h2>
              </div>
              <Link
                href="/blog"
                className="hidden items-center gap-1.5 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors md:flex"
                style={{ borderColor: '#E5E7EB', color: '#0A0A0A' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                View All Posts <ArrowRight size={14} />
              </Link>
            </div>
            <p className="mb-12 max-w-2xl" style={{ fontSize: '18px', color: '#6B7280', lineHeight: '1.7' }}>
              Expert analysis on ISO 9001, 14001, 45001 compliance and AI-powered audit automation.
            </p>
          </FadeIn>

          {/* Posts grid or empty state */}
          <FadeIn delay={0.08}>
            {latestPosts.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1"
                    style={{ border: '1px solid #E5E7EB' }}
                  >
                    <div className="h-1 w-full" style={{ background: LANDING_CATEGORY_COLORS[post.category] ?? '#6B7280' }} />
                    <div className="flex flex-1 flex-col p-6">
                      <span
                        className="mb-4 inline-block w-fit rounded-full px-3 py-1 text-xs font-medium"
                        style={{
                          background: `${LANDING_CATEGORY_COLORS[post.category] ?? '#6B7280'}10`,
                          color: LANDING_CATEGORY_COLORS[post.category] ?? '#6B7280',
                        }}
                      >
                        {post.category}
                      </span>
                      <h3
                        className="mb-2 line-clamp-2 text-lg font-semibold leading-snug transition-colors group-hover:text-blue-600"
                        style={{ color: '#0A0A0A' }}
                      >
                        {post.title}
                      </h3>
                      <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                        <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <span>·</span>
                        <span>{post.readingTime} min read</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* Empty state — Ghost hasn't published yet */
              <div
                className="flex flex-col items-center justify-center rounded-2xl py-16 text-center"
                style={{ border: '1px dashed #D1D5DB', background: '#FAFAFA' }}
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.08)' }}
                >
                  <FileText size={24} className="text-blue-500" />
                </div>
                <h3 className="mb-1 text-base font-semibold" style={{ color: '#0A0A0A' }}>
                  Coming Soon
                </h3>
                <p className="max-w-sm text-sm" style={{ color: '#6B7280' }}>
                  Ghost Sentinel is researching and writing expert ISO compliance content. Check back soon.
                </p>
              </div>
            )}
          </FadeIn>

          {/* Mobile CTA */}
          <div className="mt-8 text-center md:hidden">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600"
            >
              View All Posts <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── §13 FINAL CTA BANNER ────────────────────────────────────────── */}
      <section className="py-24 md:py-32" style={{ background: '#0A0A0A' }}>
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <FadeIn>
            <h2
              className="font-bold text-white"
              style={{
                fontSize: 'clamp(28px,4vw,48px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Ready to Pass Your Next ISO Audit?
            </h2>
            <p
              className="mx-auto mt-5 max-w-lg"
              style={{ fontSize: '18px', color: '#9CA3AF', lineHeight: '1.7' }}
            >
              Join compliance teams who stopped guessing and started certifying.
            </p>
            <div className="mt-10">
              <a
                href="#pricing"
                className="inline-block rounded-xl bg-white px-10 py-4 text-sm font-semibold transition-colors"
                style={{ color: '#0A0A0A' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                Book a Free Demo
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── §14 FOOTER ──────────────────────────────────────────────────── */}
      <footer
        className="py-16"
        style={{ background: '#0A0A0A', borderTop: '1px solid #1F2937' }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Col 1 — Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <Shield size={20} className="text-blue-500" />
                <span className="text-sm font-bold text-white">AI Sentinels</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
                ISO Compliance, Automated.
              </p>
            </div>

            {/* Col 2–4 */}
            {[
              { title: 'Product',  links: ['Platform', 'Sentinels', 'Pricing', 'Changelog'] },
              { title: 'Company',  links: ['About', 'Blog', 'Contact', 'Careers'] },
              { title: 'Legal',    links: ['Privacy Policy', 'Terms of Service'] },
            ].map((col) => (
              <div key={col.title}>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#4B5563' }}>
                  {col.title}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => {
                    const footerHrefMap: Record<string, string> = {
                      'Blog': '/blog',
                      'Privacy Policy': '/privacy',
                      'Terms of Service': '/terms',
                    };
                    const footerHref = footerHrefMap[link] ?? '#';
                    return (
                      <li key={link}>
                        <a
                          href={footerHref}
                          className="text-sm transition-colors"
                          style={{ color: '#6B7280' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#D1D5DB')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
                        >
                          {link}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div
            className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row"
            style={{ borderColor: '#1F2937' }}
          >
            <p className="text-xs" style={{ color: '#4B5563' }}>
              © 2026 AI Sentinels. All rights reserved.
            </p>
            {/* Sentinel color dots */}
            <div className="flex items-center gap-2">
              {SENTINELS.map((s) => (
                <div
                  key={s.name}
                  title={s.name}
                  style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color }}
                />
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
