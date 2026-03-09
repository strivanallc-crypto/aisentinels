'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  capaApi, auditApi, riskApi, billingApi, documentsApi,
  boardReportApi, settingsApi, auditTrailApi, reviewApi,
} from '@/lib/api';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { SENTINEL_LIST } from '@/lib/sentinels';
import {
  Wrench, ClipboardCheck, AlertTriangle, CreditCard,
  FileText, Archive, BookOpen, ArrowUpRight,
  Grid3X3, Shield, Settings, CheckCircle2, Circle, Sparkles,
  BarChart3, Download, Activity,
} from 'lucide-react';

/* ─── Types ─── */
interface Stats {
  capaOpen?: number; capaTotal?: number;
  audits?: number; risks?: number;
  creditsPct?: number; creditsUsed?: number; creditsLimit?: number;
  docCount?: number;
}

interface AuditTrailEntry {
  id?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  actorName?: string;
  actorEmail?: string;
}

/* ─── Constants ─── */
const QUICK_LINKS = [
  { href: '/document-studio',   label: 'Document Studio',   icon: FileText,       color: '#6366F1' },
  { href: '/audit',             label: 'Audit Room',        icon: ClipboardCheck, color: '#F43F5E' },
  { href: '/capa',              label: 'CAPA Engine',       icon: Wrench,         color: '#8B5CF6' },
  { href: '/risk',              label: 'Risk Navigator',    icon: AlertTriangle,  color: '#dc2626' },
  { href: '/compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3,        color: '#0891b2' },
  { href: '/records-vault',     label: 'Records Vault',     icon: Archive,        color: '#7c3aed' },
  { href: '/management-review', label: 'Mgmt Review',       icon: BookOpen,       color: '#9333ea' },
  { href: '/settings',          label: 'Settings',          icon: Settings,       color: '#64748b' },
];

/* ─── Helpers ─── */
function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Stat Card ─── */
function StatCard({
  title, value, sub, benchmark, icon: Icon, color, timedOut,
}: {
  title: string; value?: number; sub: string; benchmark?: string;
  icon: React.ElementType; color: string; timedOut?: boolean;
}) {
  const bgHex = `${color}1f`;
  const showEmpty = timedOut && value === undefined;
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color: 'var(--content-text-muted)' }}>{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: bgHex }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color: 'var(--content-text)' }}>
          {value !== undefined ? value : <span className="text-2xl" style={{ color: 'var(--content-text-dim)' }}>—</span>}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--content-text-dim)' }}>
          {showEmpty ? 'No data yet' : sub}
        </p>
        {benchmark && !showEmpty && value !== undefined && (
          <p className="mt-1.5 text-[10px]" style={{ color: 'var(--content-text-dim)' }}>{benchmark}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Dashboard Page                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [hasStandards, setHasStandards] = useState(false);
  const [latestReport, setLatestReport] = useState<{
    period: string; status: string; generatedAt: string | null; presignedUrl?: string;
  } | null>(null);
  const [activityFeed, setActivityFeed] = useState<AuditTrailEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── 5-second skeleton timeout ─────────────────────────────────────────── */
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setTimedOut(true);
      setLoading(false);
    }, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  /* ── Main data fetch (KPI cards + onboarding wizard) ───────────────────── */
  useEffect(() => {
    Promise.allSettled([
      capaApi.dashboard(),           // 0
      auditApi.list(),               // 1
      riskApi.list(),                // 2
      billingApi.getUsage(),         // 3
      documentsApi.list(),           // 4
      boardReportApi.list(),         // 5
      settingsApi.getOrg(),          // 6
      reviewApi.list(),              // 7
    ]).then(([capa, audits, risks, billing, docs, boardReports, org, reviews]) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const s: Stats = {};

      if (capa.status === 'fulfilled') {
        s.capaOpen = capa.value.data?.openCount;
        s.capaTotal = capa.value.data?.totalCount;
      }
      if (audits.status === 'fulfilled') {
        const l = audits.value.data;
        s.audits = Array.isArray(l) ? l.length : undefined;
        setAuditCount(Array.isArray(l) ? l.length : 0);
      }
      if (risks.status === 'fulfilled') {
        const l = risks.value.data;
        s.risks = Array.isArray(l) ? l.length : undefined;
      }
      if (billing.status === 'fulfilled') {
        s.creditsPct = billing.value.data?.usagePercent;
        s.creditsUsed = billing.value.data?.aiCreditsUsed;
        s.creditsLimit = billing.value.data?.aiCreditsLimit;
      }
      if (docs.status === 'fulfilled') {
        const l = docs.value.data;
        const cnt = Array.isArray(l) ? l.length : 0;
        s.docCount = cnt;
        setDocCount(cnt);
      }
      if (boardReports.status === 'fulfilled') {
        const reportList = boardReports.value;
        if (Array.isArray(reportList) && reportList.length > 0) {
          setLatestReport(reportList[0]);
        }
      }
      if (org.status === 'fulfilled') {
        const d = org.value.data;
        const stds = d?.standards ?? d?.activeStandards ?? [];
        setHasStandards(Array.isArray(stds) && stds.length > 0);
      }
      if (reviews.status === 'fulfilled') {
        const l = reviews.value.data;
        setReviewCount(Array.isArray(l) ? l.length : 0);
      }

      setStats(s);
      setLoading(false);
    });
  }, []);

  /* ── Activity feed (wired to audit-trail Lambda) ───────────────────────── */
  useEffect(() => {
    auditTrailApi
      .query({ limit: 8 })
      .then((res) => {
        const raw = res.data?.entries ?? res.data ?? [];
        setActivityFeed(Array.isArray(raw) ? raw.slice(0, 8) : []);
      })
      .catch(() => setActivityFeed([]))
      .finally(() => setActivityLoaded(true));
  }, []);

  /* ── Onboarding steps (wired to real settings API) ─────────────────────── */
  const onboardingSteps = [
    { label: 'Create your account',          href: '#',                 done: true },
    { label: 'Activate your ISO standards',  href: '/settings',         done: hasStandards },
    { label: 'Upload your first document',   href: '/document-studio',  done: docCount > 0 },
    { label: 'Run your first AI audit',      href: '/audit',            done: auditCount > 0 },
    { label: 'Complete a management review', href: '/management-review', done: reviewCount > 0 },
  ];

  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const totalSteps = onboardingSteps.length;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  /* ── KPI card definitions ──────────────────────────────────────────────── */
  const cards = [
    { title: 'Open CAPAs',  value: stats.capaOpen,  sub: `${stats.capaTotal ?? 0} total`,                                 icon: Wrench,         color: '#8B5CF6', benchmark: 'Industry avg: 3 open CAPAs' },
    { title: 'Audits',      value: stats.audits,    sub: 'scheduled / completed',                                          icon: ClipboardCheck, color: '#F43F5E', benchmark: 'Industry avg: 4/yr' },
    { title: 'Risk Items',  value: stats.risks,     sub: 'in register',                                                    icon: AlertTriangle,  color: '#dc2626', benchmark: 'Industry avg: 15' },
    { title: 'AI Credits',  value: stats.creditsPct, sub: `${stats.creditsUsed ?? 0} / ${stats.creditsLimit ?? 50} used`,  icon: CreditCard,     color: '#7c3aed' },
    { title: 'Documents',   value: stats.docCount,  sub: 'in library',                                                     icon: FileText,       color: '#6366F1' },
  ];

  /* ═════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 space-y-6 max-w-6xl" style={{ color: 'var(--content-text)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-bold">Dashboard</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            ISO 9001 / 14001 / 45001 Compliance Overview
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          System Operational
        </div>
      </div>

      {/* ── Onboarding Checklist (wired to real data) ── */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--sentinel-accent)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>
                Complete setup to get audit-ready in 14 days
              </h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
              You&apos;re {progressPct}% there — {completedSteps} of {totalSteps} steps done
            </p>
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--sentinel-accent)' }}>
            {completedSteps}/{totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full mb-5"
          style={{ background: 'var(--content-border)' }}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: 'var(--sentinel-accent)' }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {onboardingSteps.map((step) => {
            const StepIcon = step.done ? CheckCircle2 : Circle;
            const inner = (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
                <StepIcon
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: step.done ? '#22C55E' : 'var(--content-text-dim)' }}
                />
                <span
                  className="text-[13px]"
                  style={{
                    color: step.done ? 'var(--content-text-dim)' : 'var(--content-text)',
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}
                >
                  {step.label}
                </span>
                {step.done && (
                  <span className="text-[10px] font-medium ml-1" style={{ color: '#22C55E' }}>✓</span>
                )}
              </div>
            );

            return step.done ? (
              <div key={step.label}>{inner}</div>
            ) : (
              <Link
                key={step.label}
                href={step.href}
                className="block hover:bg-white/5 rounded-lg transition-colors"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Empty State Bumper (Loss Aversion) ── */}
      {!loading && docCount === 0 && (
        <div
          className="rounded-xl p-6 flex items-center gap-5"
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
          }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'rgba(245,158,11,0.15)' }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: '#F59E0B' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
              Companies without documented procedures fail 68% of audits
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-dim)' }}>
              Upload your first document to start building audit-ready compliance evidence.
            </p>
          </div>
          <Link
            href="/document-studio"
            className="flex-shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
            style={{ background: '#F59E0B', color: '#111827' }}
          >
            Go to Document Studio
          </Link>
        </div>
      )}

      {/* ── KPI Cards (graceful empty states — neutral gray, never red) ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--content-border)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => <StatCard key={c.title} {...c} timedOut={timedOut} />)}
        </div>
      )}

      {/* ── Board Report Widget (unchanged) ── */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <BarChart3 className="h-4 w-4" style={{ color: '#818CF8' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>
                Board Performance Report
              </p>
              <p className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
                {latestReport
                  ? `Latest: ${new Date(Number(latestReport.period.split('-')[0]), Number(latestReport.period.split('-')[1]) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`
                  : 'No reports generated yet'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latestReport?.status === 'ready' && latestReport.presignedUrl && (
              <a
                href={latestReport.presignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
                style={{ color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            )}
            <Link
              href="/board-report"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
              style={{ color: 'var(--content-text-muted)' }}
            >
              View All
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Sentinel Status (static "Ready" — no API call) ── */}
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            AI Sentinels — Gemini 2.5 Pro
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {SENTINEL_LIST.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-3 rounded-lg border px-3 py-3"
              style={{ borderColor: 'var(--content-border)' }}
            >
              <SentinelAvatar sentinelId={s.id} size={32} pulse />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--content-text)' }}>
                    {s.name}
                  </p>
                  {/* Green online indicator */}
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                      style={{ background: '#22C55E' }}
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ background: '#22C55E' }}
                    />
                  </span>
                </div>
                <p className="text-[10px] truncate" style={{ color: 'var(--content-text-dim)' }}>
                  Ready · Awaiting first task
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Activity + Quick Links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Activity (wired to GET /api/v1/audit-trail) */}
        <div
          className="lg:col-span-2 rounded-xl p-6"
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>Recent Activity</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-dim)' }}>
                Latest compliance actions across your organisation
              </p>
            </div>
            <Link
              href="/audit-trail"
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--content-text-muted)' }}
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {!activityLoaded ? (
            /* Skeleton while loading (max 5 seconds) */
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--content-border)' }} />
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            /* Graceful empty state */
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <BarChart3 className="h-8 w-8" style={{ color: 'var(--content-text-dim)' }} />
              <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
                Activity will appear here after your first audit
              </p>
            </div>
          ) : (
            /* Real activity feed entries */
            <div className="space-y-1">
              {activityFeed.map((entry, i) => (
                <div
                  key={entry.id ?? i}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <Activity className="h-3.5 w-3.5" style={{ color: '#818CF8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--content-text)' }}>
                      {entry.action}
                    </p>
                    {(entry.actorName || entry.actorEmail) && (
                      <p className="text-[10px] truncate" style={{ color: 'var(--content-text-dim)' }}>
                        {entry.actorName ?? entry.actorEmail}
                        {entry.entityType ? ` · ${entry.entityType}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--content-text-dim)' }}>
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--content-text)' }}>Quick Access</p>
          <div className="space-y-0.5">
            {QUICK_LINKS.map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all group hover:bg-white/5"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0"
                  style={{ background: `${color}1f` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--content-text)' }}>
                  {label}
                </span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity"
                  style={{ color: 'var(--content-text-muted)' }}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
