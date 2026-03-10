'use client';

import type { ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Hero                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
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
    <div
      className="relative space-y-8 pb-8 mb-8 overflow-hidden rounded-2xl px-8 pt-8"
      style={{
        background: `linear-gradient(135deg, rgba(17,17,17,0.9) 0%, rgba(10,10,10,0.95) 100%)`,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Decorative gradient blob */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-[120px] opacity-[0.07]"
        style={{ background: sentinelColor }}
      />

      {/* Section label — Sadewa "/" prefix pattern */}
      <p
        className="relative text-[11px] font-semibold uppercase tracking-[0.25em]"
        style={{ color: sentinelColor, opacity: 0.7 }}
      >
        / {sectionLabel}
      </p>

      {/* Title + subtitle */}
      <div className="relative space-y-3">
        <h1 className="text-3xl lg:text-[42px] font-bold font-heading leading-[1.08] tracking-tight">
          {title}
        </h1>
        <p className="text-[15px] max-w-2xl leading-relaxed" style={{ color: '#9ca3af' }}>
          {subtitle}
        </p>
      </div>

      {/* Stats row */}
      {stats && stats.length > 0 && (
        <div className="relative flex flex-wrap gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5">
              <span
                className="text-3xl lg:text-[40px] font-bold font-heading tabular-nums tracking-tight"
                style={{ color: sentinelColor }}
              >
                {stat.value}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {actions && <div className="relative flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Buttons                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
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
      className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{
        background: '#c2fa69',
        color: '#0a0a0a',
        boxShadow: '0 0 20px rgba(194,250,105,0.15)',
      }}
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
      className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] hover:bg-white/5 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Empty state                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */
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
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      {/* Pulsing ring behind number */}
      <div className="relative">
        <div
          className="absolute inset-0 -m-4 rounded-full animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }}
        />
        <span
          className="relative text-6xl font-bold font-heading"
          style={{ color: 'rgba(255,255,255,0.05)' }}
        >
          /{number}
        </span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{heading}</h3>
      <p className="text-sm max-w-md leading-relaxed" style={{ color: '#6b7280' }}>
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Section label                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
export function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="h-4 w-0.5 rounded-full" style={{ background: '#c2fa69' }} />
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: '#6b7280' }}
      >
        / {children}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Content card                                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */
export function ContentCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${className}`}
      style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Skeleton shimmer                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl animate-pulse"
          style={{
            background: 'linear-gradient(90deg, #111111 25%, #191919 50%, #111111 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}
