'use client';

import type { KpiStats } from './vault-utils';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — D1  KPI Hero Row                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface KpiHeroRowProps {
  stats: KpiStats;
  loading: boolean;
}

interface CardConfig {
  label: string;
  getValue: (s: KpiStats) => number;
  accentColor: string;
  badge?: (s: KpiStats) => string | null;
}

const CARDS: CardConfig[] = [
  {
    label: 'Total Records',
    getValue: (s) => s.total,
    accentColor: '#6366F1',
  },
  {
    label: 'Verified',
    getValue: (s) => s.verified,
    accentColor: '#22C55E',
    badge: (s) => (s.total > 0 ? `${Math.round((s.verified / s.total) * 100)}%` : null),
  },
  {
    label: 'Legal Hold',
    getValue: (s) => s.legalHold,
    accentColor: '#EF4444',
  },
  {
    label: 'Due for Disposal',
    getValue: (s) => s.dueDisposal,
    accentColor: '#F59E0B',
  },
];

export function KpiHeroRow({ stats, loading }: KpiHeroRowProps) {
  return (
    <div
      className="flex gap-4 px-6 py-4 flex-shrink-0 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {CARDS.map((card) => {
        const value = card.getValue(stats);
        const badgeText = card.badge?.(stats);

        return (
          <div
            key={card.label}
            className="flex-1 min-w-[160px] rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:shadow-lg"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {/* Accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: card.accentColor, opacity: 0.5 }}
            />

            {loading ? (
              <div className="space-y-2">
                <div
                  className="h-8 w-16 rounded-lg animate-shimmer"
                  style={{
                    background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
                    backgroundSize: '200% 100%',
                  }}
                />
                <div
                  className="h-3 w-24 rounded animate-shimmer"
                  style={{
                    background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-3xl font-bold font-heading tabular-nums tracking-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    {value}
                  </span>
                  {badgeText && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ color: card.accentColor, background: `${card.accentColor}1a` }}
                    >
                      {badgeText}
                    </span>
                  )}
                </div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider mt-1.5"
                  style={{ color: 'var(--muted)' }}
                >
                  {card.label}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
