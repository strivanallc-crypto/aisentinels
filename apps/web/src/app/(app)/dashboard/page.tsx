'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api, capaApi, auditApi, billingApi, documentsApi,
  boardReportApi, settingsApi, auditTrailApi, reviewApi,
} from '@/lib/api';
import {
  AlertTriangle, ClipboardCheck, FileText, Zap, CalendarClock,
  CheckCircle2, Circle, Activity, BarChart3, ArrowUpRight,
  Shield, Leaf, HardHat,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Types — local, defensive shapes for API responses                         */
/* ═══════════════════════════════════════════════════════════════════════════ */
interface StandardInfo {
  code?: string;
  standardCode?: string;
  name?: string;
  active?: boolean;
}
interface CapaItem  { status: string }
interface AuditItem { status: string; auditDate?: string; scheduledDate?: string }
interface TrailEntry {
  id?: string;
  action?: string;
  eventType?: string;
  entityType?: string;
  createdAt: string;
  actorName?: string;
  actorEmail?: string;
}
interface ReportItem {
  period: string;
  status?: string;
  generatedAt: string | null;
  presignedUrl?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Constants                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */
const STD_COLORS: Record<string, string> = {
  iso_9001:   '#3B82F6', 'ISO 9001':  '#3B82F6',
  iso_14001:  '#22C55E', 'ISO 14001': '#22C55E',
  iso_45001:  '#F59E0B', 'ISO 45001': '#F59E0B',
};
const STD_LABELS: Record<string, string> = {
  iso_9001: 'ISO 9001', iso_14001: 'ISO 14001', iso_45001: 'ISO 45001',
};
const STD_ICONS: Record<string, typeof Shield> = {
  iso_9001: Shield, iso_14001: Leaf, iso_45001: HardHat,
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Helpers                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr  = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Safe array extractor — handles { key: [...] } | [...] | null */
function safeArray<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && key in data) {
    const nested = (data as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

function formatPeriod(period: string): string {
  try {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  } catch {
    return period;
  }
}

/* Skeleton shimmer block */
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ background: 'linear-gradient(90deg, #111111 25%, #191919 50%, #111111 75%)', backgroundSize: '200% 100%' }}
    />
  );
}

/* Event type → icon color map for activity feed */
const ACTIVITY_COLORS: Record<string, string> = {
  document: '#6366F1',
  audit: '#F43F5E',
  capa: '#8B5CF6',
  risk: '#F59E0B',
  record: '#6366F1',
  review: '#3B82F6',
};

function activityColor(entry: TrailEntry): string {
  const type = (entry.entityType ?? entry.action ?? '').toLowerCase();
  for (const [key, color] of Object.entries(ACTIVITY_COLORS)) {
    if (type.includes(key)) return color;
  }
  return '#818CF8';
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Dashboard Page                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  /* ── Data state ── */
  const [orgName, setOrgName]                   = useState('');
  const [activeStandards, setActiveStandards]   = useState<StandardInfo[]>([]);
  const [openCapas, setOpenCapas]               = useState(0);
  const [scheduledAudits, setScheduledAudits]   = useState(0);
  const [completedAudits, setCompletedAudits]   = useState(0);
  const [totalDocs, setTotalDocs]               = useState(0);
  const [creditsUsed, setCreditsUsed]           = useState(0);
  const [creditsTotal, setCreditsTotal]         = useState(50);
  const [nextAuditDate, setNextAuditDate]       = useState<string | null>(null);
  const [hasStandards, setHasStandards]         = useState(false);
  const [auditCount, setAuditCount]             = useState(0);
  const [reviewCount, setReviewCount]           = useState(0);
  const [activity, setActivity]                 = useState<TrailEntry[]>([]);
  const [activityLoaded, setActivityLoaded]     = useState(false);
  const [latestReport, setLatestReport]         = useState<ReportItem | null>(null);

  /* ── Parallel data fetch ── */
  useEffect(() => {
    Promise.allSettled([
      settingsApi.getOrg(),                      // 0 — org name
      api.get('/api/v1/settings/standards'),      // 1 — active standards
      capaApi.list(),                             // 2 — CAPAs
      auditApi.list(),                            // 3 — audits
      documentsApi.list(),                        // 4 — documents
      billingApi.getUsage(),                      // 5 — AI credits
      auditTrailApi.query({ limit: 8 }),          // 6 — recent activity
      boardReportApi.list(),                      // 7 — board reports (returns array directly)
      reviewApi.list(),                           // 8 — management reviews
    ]).then(([org, stds, capas, audits, docs, billing, trail, reports, reviews]) => {

      /* 0 — Org */
      if (org.status === 'fulfilled') {
        const d = org.value.data as Record<string, unknown> | null;
        setOrgName(((d?.companyName ?? d?.orgName ?? '') as string).trim());
      }

      /* 1 — Standards */
      if (stds.status === 'fulfilled') {
        const list = safeArray<StandardInfo>(stds.value.data, 'standards');
        const active = list.filter((s) => s.active !== false);
        setActiveStandards(active);
        setHasStandards(active.length > 0);
      }

      /* 2 — CAPAs */
      if (capas.status === 'fulfilled') {
        const list = safeArray<CapaItem>(capas.value.data, 'capas');
        setOpenCapas(list.filter((c) => c.status === 'open').length);
      }

      /* 3 — Audits */
      if (audits.status === 'fulfilled') {
        const list = safeArray<AuditItem>(audits.value.data, 'audits');
        setScheduledAudits(list.filter((a) => a.status === 'scheduled').length);
        setCompletedAudits(list.filter((a) => a.status === 'completed').length);
        setAuditCount(list.length);
        // Next audit = earliest future scheduled date
        const futureDates = list
          .filter((a) => a.status === 'scheduled')
          .map((a) => a.auditDate ?? a.scheduledDate)
          .filter((d): d is string => !!d && new Date(d).getTime() >= Date.now())
          .sort();
        setNextAuditDate(futureDates[0] ?? null);
      }

      /* 4 — Documents */
      if (docs.status === 'fulfilled') {
        setTotalDocs(safeArray(docs.value.data, 'documents').length);
      }

      /* 5 — Billing */
      if (billing.status === 'fulfilled') {
        const d = billing.value.data as Record<string, number> | null;
        setCreditsUsed(d?.aiCreditsUsed ?? d?.used ?? 0);
        setCreditsTotal(d?.aiCreditsLimit ?? d?.total ?? 50);
      }

      /* 6 — Audit trail */
      if (trail.status === 'fulfilled') {
        const list = safeArray<TrailEntry>(trail.value.data, 'events');
        const fallback = list.length > 0 ? list : safeArray<TrailEntry>(trail.value.data, 'entries');
        setActivity((fallback.length > 0 ? fallback : list).slice(0, 8));
      }
      setActivityLoaded(true);

      /* 7 — Board reports (boardReportApi.list() returns ReportItem[] directly) */
      if (reports.status === 'fulfilled') {
        const list = reports.value as ReportItem[];
        if (Array.isArray(list) && list.length > 0) {
          setLatestReport(list[0]);
        }
      }

      /* 8 — Management reviews */
      if (reviews.status === 'fulfilled') {
        setReviewCount(safeArray(reviews.value.data, 'reviews').length);
      }

      setLoading(false);
    });
  }, []);

  /* ── Derived values ── */
  const greeting     = getGreeting();
  const creditsPct   = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;

  /* ── Setup Wizard ── */
  const wizardSteps = [
    { label: 'Create account',        done: true,             href: '#' },
    { label: 'Activate standards',    done: hasStandards,     href: '/settings' },
    { label: 'Upload first document', done: totalDocs > 0,    href: '/document-studio' },
    { label: 'Run first audit',       done: auditCount > 0,   href: '/audit' },
    { label: 'Complete mgmt review',  done: reviewCount > 0,  href: '/management-review' },
  ];
  const wizardDone      = wizardSteps.filter((s) => s.done).length;
  const wizardTotal     = wizardSteps.length;
  const allWizardDone   = wizardDone === wizardTotal;
  const wizardPct       = Math.round((wizardDone / wizardTotal) * 100);

  /* ═════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1280px]">

      {/* ══ ROW 1 — Welcome + Sentinel Status Grid ════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="space-y-3">
          {loading ? (
            <Skeleton className="h-10 w-80" />
          ) : (
            <h1 className="text-2xl lg:text-[34px] font-bold font-heading tracking-tight leading-[1.1]">
              {greeting}{orgName ? `, ${orgName}` : ''}
            </h1>
          )}
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Your integrated management system at a glance.
          </p>
        </div>

        {/* Sentinel Status Grid — active standards */}
        <div className="flex items-center gap-3">
          {loading ? (
            <>
              <Skeleton className="h-10 w-28 !rounded-xl" />
              <Skeleton className="h-10 w-28 !rounded-xl" />
            </>
          ) : activeStandards.length > 0 ? (
            activeStandards.map((s) => {
              const code  = s.standardCode ?? s.code ?? '';
              const label = STD_LABELS[code] ?? s.name ?? code;
              const color = STD_COLORS[code] ?? STD_COLORS[label] ?? '#6b7280';
              const Icon  = STD_ICONS[code] ?? Shield;
              return (
                <div
                  key={code}
                  className="flex items-center gap-2 rounded-xl px-3.5 py-2 transition-shadow duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                  style={{
                    background: `${color}0d`,
                    border: `1px solid ${color}25`,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-[12px] font-semibold" style={{ color }}>
                    {label}
                  </span>
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: color }} />
                </div>
              );
            })
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-medium transition-colors hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}
            >
              <Shield className="h-3.5 w-3.5" />
              Activate standards
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}

          {/* System status */}
          <div
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[11px] font-semibold"
            style={{
              background: 'rgba(34,197,94,0.06)',
              color: '#22C55E',
              border: '1px solid rgba(34,197,94,0.15)',
            }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Operational
          </div>
        </div>
      </div>

      {/* ══ ROW 2 — 5 KPI Cards ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))
        ) : (
          <>
            {/* 1 — Open CAPAs */}
            <div
              className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  Open CAPAs
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(139,92,246,0.12)' }}
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: '#8B5CF6' }} />
                </div>
              </div>
              <p className="text-3xl font-bold font-heading tabular-nums">{openCapas}</p>
              <p className="text-[11px]" style={{ color: '#4b5563' }}>requiring action</p>
            </div>

            {/* 2 — Audits */}
            <div
              className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  Audits
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(244,63,94,0.12)' }}
                >
                  <ClipboardCheck className="h-4 w-4" style={{ color: '#F43F5E' }} />
                </div>
              </div>
              <p className="text-3xl font-bold font-heading tabular-nums">
                {scheduledAudits + completedAudits > 0
                  ? scheduledAudits + completedAudits
                  : <span className="text-2xl" style={{ color: '#4b5563' }}>&mdash;</span>}
              </p>
              <p className="text-[11px]" style={{ color: '#4b5563' }}>
                {scheduledAudits} scheduled / {completedAudits} completed
              </p>
            </div>

            {/* 3 — Documents */}
            <div
              className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  Documents
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(99,102,241,0.12)' }}
                >
                  <FileText className="h-4 w-4" style={{ color: '#6366F1' }} />
                </div>
              </div>
              <p className="text-3xl font-bold font-heading tabular-nums">{totalDocs}</p>
              <p className="text-[11px]" style={{ color: '#4b5563' }}>in library</p>
            </div>

            {/* 4 — AI Credits */}
            <div
              className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  AI Credits
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(194,250,105,0.12)' }}
                >
                  <Zap className="h-4 w-4" style={{ color: '#c2fa69' }} />
                </div>
              </div>
              <p className="text-3xl font-bold font-heading tabular-nums">
                {creditsUsed}
                <span className="text-base font-normal ml-1" style={{ color: '#6b7280' }}>
                  / {creditsTotal}
                </span>
              </p>
              <div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(creditsPct, 100)}%`,
                      background: creditsPct >= 90 ? '#dc2626' : creditsPct >= 70 ? '#d97706' : '#c2fa69',
                    }}
                  />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#4b5563' }}>used this period</p>
              </div>
            </div>

            {/* 5 — Next Audit */}
            <div
              className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  Next Audit
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(59,130,246,0.12)' }}
                >
                  <CalendarClock className="h-4 w-4" style={{ color: '#3B82F6' }} />
                </div>
              </div>
              <p className="text-3xl font-bold font-heading tabular-nums">
                {nextAuditDate
                  ? new Date(nextAuditDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : <span className="text-2xl" style={{ color: '#4b5563' }}>&mdash;</span>}
              </p>
              <p className="text-[11px]" style={{ color: '#4b5563' }}>
                {nextAuditDate
                  ? new Date(nextAuditDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'No audits scheduled'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ══ ROW 3 — Setup Wizard (hide when all 5 complete) ══════════════ */}
      {!loading && !allWizardDone && (
        <div
          className="rounded-2xl p-6"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-0.5 rounded-full" style={{ background: '#c2fa69' }} />
              <h2 className="text-sm font-semibold font-heading uppercase tracking-wide">Getting Started</h2>
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color: '#c2fa69' }}>
              {wizardDone}/{wizardTotal}
            </span>
          </div>

          {/* Progress bar — lime fill */}
          <div
            className="h-1.5 w-full overflow-hidden rounded-full mb-5"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${wizardPct}%`, background: '#c2fa69' }}
            />
          </div>

          <div className="space-y-1">
            {wizardSteps.map((step) => {
              const StepIcon = step.done ? CheckCircle2 : Circle;
              const inner = (
                <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors">
                  <StepIcon
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: step.done ? '#22C55E' : '#4b5563' }}
                  />
                  <span
                    className="text-[13px]"
                    style={{
                      color: step.done ? '#6b7280' : '#fff',
                      textDecoration: step.done ? 'line-through' : 'none',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              );

              return step.done ? (
                <div key={step.label}>{inner}</div>
              ) : (
                <Link
                  key={step.label}
                  href={step.href}
                  className="block hover:bg-white/5 rounded-xl transition-colors"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ ROW 4 — Two columns: Activity (8) + Board Report (4) ═════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left (8 col): Recent Activity ── */}
        <div
          className="lg:col-span-8 rounded-2xl p-6 transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-4 w-0.5 rounded-full" style={{ background: '#c2fa69' }} />
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wide">Recent Activity</h2>
          </div>

          {!activityLoaded ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="relative">
                <div className="absolute inset-0 -m-3 rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />
                <Activity className="relative h-8 w-8" style={{ color: '#4b5563' }} />
              </div>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                No activity yet. Start by uploading a document.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {activity.map((entry, i) => {
                const color = activityColor(entry);
                return (
                  <div
                    key={entry.id ?? i}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: `${color}15` }}
                    >
                      <Activity className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {entry.action ?? entry.eventType ?? 'Activity'}
                      </p>
                      {(entry.actorName || entry.actorEmail) && (
                        <p className="text-[10px] truncate" style={{ color: '#6b7280' }}>
                          {entry.actorName ?? entry.actorEmail}
                          {entry.entityType ? ` \u00B7 ${entry.entityType}` : ''}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-medium tabular-nums flex-shrink-0"
                      style={{ color: '#4b5563' }}
                    >
                      {timeAgo(entry.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right (4 col): Last Board Report ── */}
        <div
          className="lg:col-span-4 rounded-2xl p-6 transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-4 w-0.5 rounded-full" style={{ background: '#818CF8' }} />
            <BarChart3 className="h-4 w-4" style={{ color: '#818CF8' }} />
            <h2 className="text-sm font-semibold font-heading uppercase tracking-wide">Board Report</h2>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : latestReport ? (
            <div className="space-y-4">
              <div>
                <p className="text-[14px] font-semibold">
                  {formatPeriod(latestReport.period)}
                </p>
                {latestReport.generatedAt && (
                  <p className="text-[11px] mt-1" style={{ color: '#6b7280' }}>
                    Generated {timeAgo(latestReport.generatedAt)}
                  </p>
                )}
              </div>

              {latestReport.status === 'ready' && latestReport.presignedUrl && (
                <a
                  href={latestReport.presignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                  style={{ color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)' }}
                >
                  Download Report
                </a>
              )}

              <Link
                href="/board-report"
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: '#9ca3af' }}
              >
                View all reports
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="relative">
                <div className="absolute inset-0 -m-3 rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />
                <BarChart3 className="relative h-8 w-8" style={{ color: '#4b5563' }} />
              </div>
              <p className="text-sm text-center" style={{ color: '#6b7280' }}>
                No reports yet.
              </p>
              <Link
                href="/board-report"
                className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: '#c2fa69' }}
              >
                Generate Report
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
