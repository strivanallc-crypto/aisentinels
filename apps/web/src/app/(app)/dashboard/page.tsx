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
      style={{ background: '#111111' }}
    />
  );
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
    <div className="p-6 space-y-6 max-w-[1280px]">

      {/* ══ ROW 1 — Welcome + status ══════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          {loading ? (
            <Skeleton className="h-9 w-80 mb-2" />
          ) : (
            <h1 className="text-2xl lg:text-3xl font-bold font-heading">
              {greeting}{orgName ? `, ${orgName}` : ''}
            </h1>
          )}

          {/* Active standards badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {loading ? (
              <>
                <Skeleton className="h-6 w-20 !rounded-md" />
                <Skeleton className="h-6 w-20 !rounded-md" />
              </>
            ) : activeStandards.length > 0 ? (
              activeStandards.map((s) => {
                const code  = s.standardCode ?? s.code ?? '';
                const label = STD_LABELS[code] ?? s.name ?? code;
                const color = STD_COLORS[code] ?? STD_COLORS[label] ?? '#6b7280';
                return (
                  <span
                    key={code}
                    className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      background: `${color}1a`,
                      color,
                      border: `1px solid ${color}33`,
                    }}
                  >
                    {label}
                  </span>
                );
              })
            ) : (
              <span className="text-[12px]" style={{ color: '#6b7280' }}>
                No standards activated yet
              </span>
            )}
          </div>
        </div>

        {/* System Operational badge */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium self-start"
          style={{
            background: 'rgba(34,197,94,0.1)',
            color: '#22C55E',
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          System Operational
        </div>
      </div>

      {/* ══ ROW 2 — 5 KPI Cards ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[136px]" />
          ))
        ) : (
          <>
            {/* 1 — Open CAPAs */}
            <div
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium" style={{ color: '#9ca3af' }}>
                  Open CAPAs
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(139,92,246,0.12)' }}
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: '#8B5CF6' }} />
                </div>
              </div>
              <p className="text-3xl font-bold">{openCapas}</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>requiring action</p>
            </div>

            {/* 2 — Audits */}
            <div
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium" style={{ color: '#9ca3af' }}>
                  Audits
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(244,63,94,0.12)' }}
                >
                  <ClipboardCheck className="h-4 w-4" style={{ color: '#F43F5E' }} />
                </div>
              </div>
              <p className="text-3xl font-bold">
                {scheduledAudits + completedAudits > 0
                  ? scheduledAudits + completedAudits
                  : <span className="text-2xl" style={{ color: '#4b5563' }}>—</span>}
              </p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {scheduledAudits} scheduled / {completedAudits} completed
              </p>
            </div>

            {/* 3 — Documents */}
            <div
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium" style={{ color: '#9ca3af' }}>
                  Documents
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(99,102,241,0.12)' }}
                >
                  <FileText className="h-4 w-4" style={{ color: '#6366F1' }} />
                </div>
              </div>
              <p className="text-3xl font-bold">{totalDocs}</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>in library</p>
            </div>

            {/* 4 — AI Credits */}
            <div
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium" style={{ color: '#9ca3af' }}>
                  AI Credits
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(194,250,105,0.12)' }}
                >
                  <Zap className="h-4 w-4" style={{ color: '#c2fa69' }} />
                </div>
              </div>
              <p className="text-3xl font-bold">
                {creditsUsed}
                <span className="text-base font-normal" style={{ color: '#6b7280' }}>
                  {' '}/ {creditsTotal}
                </span>
              </p>
              <div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(creditsPct, 100)}%`,
                      background: '#c2fa69',
                    }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: '#6b7280' }}>used this period</p>
              </div>
            </div>

            {/* 5 — Next Audit */}
            <div
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium" style={{ color: '#9ca3af' }}>
                  Next Audit
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(59,130,246,0.12)' }}
                >
                  <CalendarClock className="h-4 w-4" style={{ color: '#3B82F6' }} />
                </div>
              </div>
              <p className="text-3xl font-bold">
                {nextAuditDate
                  ? new Date(nextAuditDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : <span className="text-2xl" style={{ color: '#4b5563' }}>—</span>}
              </p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
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
          className="rounded-xl p-6"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold font-heading">Getting Started</h2>
            <span className="text-sm font-bold" style={{ color: '#c2fa69' }}>
              {wizardDone}/{wizardTotal}
            </span>
          </div>

          {/* Progress bar — lime fill */}
          <div
            className="h-1.5 w-full overflow-hidden rounded-full mb-5"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${wizardPct}%`, background: '#c2fa69' }}
            />
          </div>

          <div className="space-y-1">
            {wizardSteps.map((step) => {
              const StepIcon = step.done ? CheckCircle2 : Circle;
              const inner = (
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
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
                  className="block hover:bg-white/5 rounded-lg transition-colors"
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
          className="lg:col-span-8 rounded-xl p-6"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-sm font-semibold font-heading mb-5">Recent Activity</h2>

          {!activityLoaded ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Activity className="h-8 w-8" style={{ color: '#4b5563' }} />
              <p className="text-sm" style={{ color: '#6b7280' }}>
                No activity yet. Start by uploading a document.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {activity.map((entry, i) => (
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
                    <p className="text-[13px] font-medium truncate">
                      {entry.action ?? entry.eventType ?? 'Activity'}
                    </p>
                    {(entry.actorName || entry.actorEmail) && (
                      <p className="text-[10px] truncate" style={{ color: '#6b7280' }}>
                        {entry.actorName ?? entry.actorEmail}
                        {entry.entityType ? ` · ${entry.entityType}` : ''}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] flex-shrink-0"
                    style={{ color: '#6b7280' }}
                  >
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right (4 col): Last Board Report ── */}
        <div
          className="lg:col-span-4 rounded-xl p-6"
          style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4" style={{ color: '#818CF8' }} />
            <h2 className="text-sm font-semibold font-heading">Last Board Report</h2>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : latestReport ? (
            <div className="space-y-3">
              <div>
                <p className="text-[13px] font-medium">
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
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
                  style={{ color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
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
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <BarChart3 className="h-8 w-8" style={{ color: '#4b5563' }} />
              <p className="text-sm text-center" style={{ color: '#6b7280' }}>
                No reports yet.
              </p>
              <Link
                href="/board-report"
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
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
