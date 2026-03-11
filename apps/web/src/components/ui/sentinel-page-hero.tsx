'use client';

import type { ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Hero — Sadewa-inspired premium page hero                                  */
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
      className="relative space-y-6 pb-8 mb-8 overflow-hidden rounded-2xl px-8 pt-8"
      style={{
        background: 'var(--hero-bg)',
        border: '1px solid var(--hero-border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {/* Decorative gradient blob */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-[120px] opacity-[0.08]"
        style={{ background: sentinelColor }}
      />

      {/* Accent line */}
      <div className="w-12 h-[3px] rounded-full" style={{ background: sentinelColor, opacity: 0.5 }} />

      {/* Section label — Sadewa "/" prefix pattern */}
      <p
        className="relative text-[11px] font-semibold uppercase tracking-[0.25em]"
        style={{ color: 'var(--muted)' }}
      >
        / {sectionLabel}
      </p>

      {/* Title + subtitle */}
      <div className="relative space-y-3">
        <h1
          className="text-3xl lg:text-[42px] font-bold font-heading leading-[1.08] tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          {title}
        </h1>
        <p
          className="text-[15px] max-w-2xl leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {subtitle}
        </p>
      </div>

      {/* Stats row */}
      {stats && stats.length > 0 && (
        <div className="relative flex flex-wrap gap-12 pt-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5">
              <span
                className="text-3xl lg:text-[40px] font-bold font-heading tabular-nums tracking-tight"
                style={{ color: 'var(--text)' }}
              >
                {stat.value}
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
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
/* Primary Button — Sadewa lime-green style with arrow box                   */
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
      className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        boxShadow: '0 2px 12px var(--accent-glow)',
      }}
    >
      {loading && (
        <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Secondary Button — outline style                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */
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
      className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{
        border: '1px solid var(--btn-secondary-border)',
        color: 'var(--btn-secondary-text)',
        background: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Empty state — with Sadewa /01 numbering and pulsing ring                  */
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
          style={{ background: 'radial-gradient(circle, var(--row-hover) 0%, transparent 70%)' }}
        />
        <span
          className="relative text-6xl font-bold font-heading"
          style={{ color: 'var(--row-number)' }}
        >
          /{number}
        </span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
        {heading}
      </h3>
      <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--muted)' }}>
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Section label — with accent bar                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
export function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="h-4 w-[3px] rounded-full" style={{ background: 'var(--accent)' }} />
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: 'var(--muted)' }}
      >
        / {children}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Content card — theme-aware                                                */
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
      className={`rounded-2xl p-6 transition-all duration-300 hover:shadow-lg ${className}`}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Skeleton shimmer — theme-aware                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl animate-shimmer"
          style={{
            background: `linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)`,
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}
