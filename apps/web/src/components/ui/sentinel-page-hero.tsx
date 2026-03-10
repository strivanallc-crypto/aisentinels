'use client';

import type { ReactNode } from 'react';

interface HeroStat {
  value: string;
  label: string;
}

interface SentinelPageHeroProps {
  sectionLabel: string;
  title: string;
  subtitle: string;
  sentinelName?: string;
  sentinelColor?: string;
  stats?: HeroStat[];
  actions?: ReactNode;
}

export function SentinelPageHero({
  sectionLabel,
  title,
  subtitle,
  sentinelColor = '#c2fa69',
  stats,
  actions,
}: SentinelPageHeroProps) {
  return (
    <div className="space-y-8 pb-8 mb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Section label — Sadewa "/" prefix pattern */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: '#6b7280' }}
      >
        / {sectionLabel}
      </p>

      {/* Title + subtitle */}
      <div className="space-y-3">
        <h1 className="text-3xl lg:text-4xl font-bold font-heading leading-tight">
          {title}
        </h1>
        <p className="text-base max-w-2xl" style={{ color: '#6b7280' }}>
          {subtitle}
        </p>
      </div>

      {/* Stats row */}
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-10">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span
                className="text-3xl lg:text-4xl font-bold font-heading"
                style={{ color: sentinelColor }}
              >
                {stat.value}
              </span>
              <span className="text-[12px] font-medium" style={{ color: '#6b7280' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/* ── Reusable Sadewa-style buttons ── */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: '#c2fa69', color: '#0a0a0a' }}
    >
      {loading && (
        <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
    >
      {children}
    </button>
  );
}

/* ── Sadewa empty state pattern ── */
export function SadewaEmptyState({
  number = '00',
  heading,
  description,
  action,
}: {
  number?: string;
  heading: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <span
        className="text-5xl font-bold font-heading"
        style={{ color: 'rgba(255,255,255,0.06)' }}
      >
        /{number}
      </span>
      <h3 className="text-lg font-semibold">{heading}</h3>
      <p className="text-sm max-w-md" style={{ color: '#6b7280' }}>
        {description}
      </p>
      {action}
    </div>
  );
}

/* ── Section divider label ── */
export function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
      style={{ color: '#6b7280' }}
    >
      / {children}
    </p>
  );
}

/* ── Content card wrapper ── */
export function ContentCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-6 ${className}`}
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {children}
    </div>
  );
}

/* ── Skeleton shimmer ── */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl animate-pulse"
          style={{ background: '#111111' }}
        />
      ))}
    </div>
  );
}
