'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  capaApi, sentinelsApi, auditApi, riskApi, billingApi, documentsApi,
  boardReportApi,
} from '@/lib/api';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { SENTINEL_LIST } from '@/lib/sentinels';
import {
  Wrench, Bot, ClipboardCheck, AlertTriangle, CreditCard,
  FileText, Archive, BookOpen, TrendingUp, ArrowUpRight,
  Grid3X3, Shield, Settings, CheckCircle2, Circle, Sparkles,
  BarChart3, Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

/* ─── Types ─── */
interface Stats {
  capaOpen?: number; capaTotal?: number;
  aiActivities?: number; audits?: number; risks?: number;
  creditsPct?: number; creditsUsed?: number; creditsLimit?: number;
}

/* ─── Constants ─── */
const MOCK_ACTIVITY = [
  { name: 'Mon', value: 3 }, { name: 'Tue', value: 7 }, { name: 'Wed', value: 5 },
  { name: 'Thu', value: 9 }, { name: 'Fri', value: 4 }, { name: 'Sat', value: 2 },
  { name: 'Sun', value: 6 },
];

const ONBOARDING_STEPS = [
  { label: 'Create your account',           href: '#',                done: true },
  { label: 'Activate your ISO standards',   href: '/settings' },
  { label: 'Upload your first document',    href: '/document-studio' },
  { label: 'Run your first AI audit',       href: '/audit' },
  { label: 'Complete a management review',  href: '/management-review' },
];

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

/* ─── Stat Card ─── */
function StatCard({
  title, value, sub, benchmark, icon: Icon, color,
}: {
  title: string; value?: number; sub: string; benchmark?: string;
  icon: React.ElementType; color: string;
}) {
  const bgHex = `${color}1f`; // 12% opacity
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
        <p className="mt-0.5 text-xs" style={{ color: 'var(--content-text-dim)' }}>{sub}</p>
        {benchmark && (
          <p className="mt-1.5 text-[10px]" style={{ color: 'var(--content-text-dim)' }}>{benchmark}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [latestReport, setLatestReport] = useState<{
    period: string; status: string; generatedAt: string | null; presignedUrl?: string;
  } | null>(null);

  useEffect(() => {
    Promise.allSettled([
      capaApi.dashboard(),
      sentinelsApi.stats(),
      auditApi.list(),
      riskApi.list(),
      billingApi.getUsage(),
      documentsApi.list(),
      boardReportApi.list(),
    ]).then(([capa, ai, audits, risks, billing, docs, boardReports]) => {
      setStats({
        capaOpen:     capa.status    === 'fulfilled' ? capa.value.data?.openCount       : undefined,
        capaTotal:    capa.status    === 'fulfilled' ? capa.value.data?.totalCount      : undefined,
        aiActivities: ai.status      === 'fulfilled' ? ai.value.data?.totalActivities   : undefined,
        audits:       audits.status  === 'fulfilled' ? audits.value.data?.length        : undefined,
        risks:        risks.status   === 'fulfilled' ? risks.value.data?.length         : undefined,
        creditsPct:   billing.status === 'fulfilled' ? billing.value.data?.usagePercent  : undefined,
        creditsUsed:  billing.status === 'fulfilled' ? billing.value.data?.aiCreditsUsed : undefined,
        creditsLimit: billing.status === 'fulfilled' ? billing.value.data?.aiCreditsLimit : undefined,
      });
      if (docs.status === 'fulfilled') {
        const list = docs.value.data;
        setDocCount(Array.isArray(list) ? list.length : 0);
      } else {
        setDocCount(0);
      }
      if (boardReports.status === 'fulfilled') {
        const reportList = boardReports.value;
        if (Array.isArray(reportList) && reportList.length > 0) {
          setLatestReport(reportList[0]);
        }
      }
      setLoading(false);
    });
  }, []);

  const completedSteps = ONBOARDING_STEPS.filter((s) => s.done).length;
  const totalSteps = ONBOARDING_STEPS.length;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  const cards = [
    { title: 'Open CAPAs',  value: stats.capaOpen,     sub: `${stats.capaTotal ?? 0} total`,                                     icon: Wrench,         color: '#8B5CF6', benchmark: 'Industry avg: 3 open CAPAs' },
    { title: 'AI Analyses', value: stats.aiActivities, sub: 'analyses run',                                                      icon: Bot,            color: '#2563eb', benchmark: 'Industry avg: 24/mo' },
    { title: 'Audits',      value: stats.audits,       sub: 'scheduled / completed',                                             icon: ClipboardCheck, color: '#F43F5E', benchmark: 'Industry avg: 4/yr' },
    { title: 'Risk Items',  value: stats.risks,        sub: 'in register',                                                       icon: AlertTriangle,  color: '#dc2626', benchmark: 'Industry avg: 15' },
    { title: 'AI Credits',  value: stats.creditsPct,   sub: `${stats.creditsUsed ?? 0} / ${stats.creditsLimit ?? 50} used`, icon: CreditCard,     color: '#7c3aed' },
  ];

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

      {/* ── Onboarding Checklist (Endowed Progress / Zeigarnik Effect) ── */}
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
          {ONBOARDING_STEPS.map((step) => {
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

      {/* ── KPI Cards (Social Proof Benchmarks) ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--content-border)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => <StatCard key={c.title} {...c} />)}
        </div>
      )}

      {/* ── Board Report Widget ── */}
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

      {/* ── Sentinel Status (Shield + Pulse) ── */}
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
                  {/* Online pulse */}
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
                <p className="text-[10px] truncate" style={{ color: 'var(--content-text-dim)' }}>{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chart + Quick Links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity Chart (Dark) */}
        <div
          className="lg:col-span-2 rounded-xl p-6"
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>Weekly Activity</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-dim)' }}>Compliance actions this week</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#22C55E' }}>
              <TrendingUp className="h-3.5 w-3.5" />
              +12% vs last week
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MOCK_ACTIVITY} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#F9FAFB',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {MOCK_ACTIVITY.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === 3 ? 'var(--sentinel-accent, #6366F1)' : 'rgba(99,102,241,0.2)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Links (Dark) */}
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
