'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { capaApi, sentinelsApi, auditApi, riskApi, billingApi } from '@/lib/api';
import {
  Wrench, Bot, ClipboardCheck, AlertTriangle, CreditCard,
  FileText, Archive, BookOpen, TrendingUp, ArrowUpRight,
  Grid3X3, Shield, Settings,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface Stats {
  capaOpen?: number; capaTotal?: number;
  aiActivities?: number; audits?: number; risks?: number;
  creditsPct?: number; creditsUsed?: number; creditsLimit?: number;
}

const MOCK_ACTIVITY = [
  { name: 'Mon', value: 3 }, { name: 'Tue', value: 7 }, { name: 'Wed', value: 5 },
  { name: 'Thu', value: 9 }, { name: 'Fri', value: 4 }, { name: 'Sat', value: 2 },
  { name: 'Sun', value: 6 },
];

function StatCard({
  title, value, sub, icon: Icon, color, bg,
}: {
  title: string; value?: number; sub: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color: 'var(--content-text-muted)' }}>{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: bg }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color: 'var(--content-text)' }}>
          {value !== undefined ? value : <span className="text-2xl" style={{ color: 'var(--content-text-dim)' }}>—</span>}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--content-text-dim)' }}>{sub}</p>
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { href: '/document-studio',   label: 'Document Studio',   icon: FileText,       color: '#6366F1', bg: '#eef2ff' },
  { href: '/audit',             label: 'Audit Room',        icon: ClipboardCheck, color: '#F43F5E', bg: '#fff1f2' },
  { href: '/capa',              label: 'CAPA Engine',       icon: Wrench,         color: '#8B5CF6', bg: '#f5f3ff' },
  { href: '/risk',              label: 'Risk Navigator',    icon: AlertTriangle,  color: '#dc2626', bg: '#fef2f2' },
  { href: '/compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3,        color: '#0891b2', bg: '#ecfeff' },
  { href: '/records-vault',     label: 'Records Vault',     icon: Archive,        color: '#7c3aed', bg: '#f5f3ff' },
  { href: '/management-review', label: 'Mgmt Review',       icon: BookOpen,       color: '#9333ea', bg: '#faf5ff' },
  { href: '/settings',          label: 'Settings',          icon: Settings,       color: '#64748b', bg: '#f8fafc' },
];

const SENTINELS = [
  { name: 'Qualy',  role: 'ISO 9001',       color: '#3B82F6' },
  { name: 'Envi',   role: 'ISO 14001',      color: '#22C55E' },
  { name: 'Saffy',  role: 'ISO 45001',      color: '#F59E0B' },
  { name: 'Doki',   role: 'Doc Studio',     color: '#6366F1' },
  { name: 'Audie',  role: 'Audit Room',     color: '#F43F5E' },
  { name: 'Nexus',  role: 'CAPA Engine',    color: '#8B5CF6' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([capaApi.dashboard(), sentinelsApi.stats(), auditApi.list(), riskApi.list(), billingApi.getUsage()])
      .then(([capa, ai, audits, risks, billing]) => {
        setStats({
          capaOpen:     capa.status    === 'fulfilled' ? capa.value.data?.openCount      : undefined,
          capaTotal:    capa.status    === 'fulfilled' ? capa.value.data?.totalCount     : undefined,
          aiActivities: ai.status      === 'fulfilled' ? ai.value.data?.totalActivities  : undefined,
          audits:       audits.status  === 'fulfilled' ? audits.value.data?.length       : undefined,
          risks:        risks.status   === 'fulfilled' ? risks.value.data?.length        : undefined,
          creditsPct:   billing.status === 'fulfilled' ? billing.value.data?.usagePercent : undefined,
          creditsUsed:  billing.status === 'fulfilled' ? billing.value.data?.aiCreditsUsed : undefined,
          creditsLimit: billing.status === 'fulfilled' ? billing.value.data?.aiCreditsLimit : undefined,
        });
        setLoading(false);
      });
  }, []);

  const cards = [
    { title: 'Open CAPAs',  value: stats.capaOpen,     sub: `${stats.capaTotal ?? 0} total`,                                       icon: Wrench,         color: '#8B5CF6', bg: '#f5f3ff' },
    { title: 'AI Analyses', value: stats.aiActivities, sub: 'analyses run',                                                        icon: Bot,            color: '#2563eb', bg: '#eff6ff' },
    { title: 'Audits',      value: stats.audits,       sub: 'scheduled / completed',                                               icon: ClipboardCheck, color: '#F43F5E', bg: '#fff1f2' },
    { title: 'Risk Items',  value: stats.risks,        sub: 'in register',                                                         icon: AlertTriangle,  color: '#dc2626', bg: '#fef2f2' },
    { title: 'AI Credits',  value: stats.creditsPct,   sub: `${stats.creditsUsed ?? 0} / ${stats.creditsLimit ?? 100} used`, icon: CreditCard,     color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl" style={{ color: 'var(--content-text)' }}>

      {/* Header */}
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
          style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          System Operational
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--content-border)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => <StatCard key={c.title} {...c} />)}
        </div>
      )}

      {/* Sentinel Status */}
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
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {SENTINELS.map((s) => (
            <div key={s.name} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--content-border)' }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <div>
                <p className="text-xs font-semibold">{s.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity Chart */}
        <div
          className="lg:col-span-2 rounded-xl p-6"
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-semibold">Weekly Activity</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--content-text-dim)' }}>Compliance actions this week</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#16a34a' }}>
              <TrendingUp className="h-3.5 w-3.5" />
              +12% vs last week
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MOCK_ACTIVITY} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} width={24} />
              <Tooltip
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {MOCK_ACTIVITY.map((_, i) => (
                  <Cell key={i} fill={i === 3 ? '#2563eb' : '#dbeafe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Links */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
        >
          <p className="text-sm font-semibold mb-4">Quick Access</p>
          <div className="space-y-0.5">
            {QUICK_LINKS.map(({ href, label, icon: Icon, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all group hover:bg-gray-50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0" style={{ background: bg }}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <span className="flex-1 text-[13px] font-medium">{label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'var(--content-text-muted)' }} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
