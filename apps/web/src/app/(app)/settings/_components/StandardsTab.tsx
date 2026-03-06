'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { settingsApi } from '@/lib/api';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import type { SentinelId } from '@/lib/sentinels';

const STANDARDS = [
  {
    code: 'ISO 9001',
    label: 'ISO 9001:2015',
    subtitle: 'Quality Management System',
    sentinel: 'Qualy',
    sentinelId: 'qualy' as SentinelId,
    color: '#3B82F6',
    description:
      'Requirements for a quality management system to consistently provide products and services that meet customer and regulatory requirements.',
  },
  {
    code: 'ISO 14001',
    label: 'ISO 14001:2015',
    subtitle: 'Environmental Management System',
    sentinel: 'Envi',
    sentinelId: 'envi' as SentinelId,
    color: '#22C55E',
    description:
      'Framework for an environmental management system to enhance environmental performance and manage environmental responsibilities.',
  },
  {
    code: 'ISO 45001',
    label: 'ISO 45001:2018',
    subtitle: 'OH&S Management System',
    sentinel: 'Saffy',
    sentinelId: 'saffy' as SentinelId,
    color: '#F59E0B',
    description:
      'Requirements for occupational health and safety management to prevent work-related injury and ill health.',
  },
];

export function StandardsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getOrg()
      .then(({ data }) => {
        const org = data as { certificationTargets?: string[] } | null;
        setActiveCodes(org?.certificationTargets ?? []);
      })
      .catch(() => toast({ title: 'Failed to load standards', variant: 'error' }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (code: string) => {
    const wasActive = activeCodes.includes(code);
    // Optimistic update
    setActiveCodes((prev) =>
      wasActive ? prev.filter((c) => c !== code) : [...prev, code],
    );
    setToggling(code);
    try {
      if (wasActive) {
        await settingsApi.deactivateStandard(code);
        toast({ title: `${code} deactivated`, variant: 'info' });
      } else {
        await settingsApi.activateStandard(code);
        toast({ title: `${code} activated`, variant: 'success' });
      }
    } catch {
      // Revert optimistic update
      setActiveCodes((prev) =>
        wasActive ? [...prev, code] : prev.filter((c) => c !== code),
      );
      toast({ title: `Failed to update ${code}`, variant: 'error' });
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[10px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm mb-5" style={{ color: 'var(--content-text-dim)' }}>
        Activate the ISO standards your organisation is certified against or working towards.
        Each standard is powered by a dedicated AI Sentinel.
      </p>

      <div className="space-y-4">
        {STANDARDS.map((s) => {
          const active = activeCodes.includes(s.code);
          const isToggling = toggling === s.code;
          return (
            <div
              key={s.code}
              className="rounded-[10px] border p-5 transition-all"
              style={{
                background: '#111827',
                borderColor: active ? `${s.color}40` : 'rgba(255,255,255,0.07)',
                boxShadow: active ? `0 0 20px ${s.color}10` : 'none',
              }}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <SentinelAvatar sentinelId={s.sentinelId} size={44} ring />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-white">{s.label}</span>
                    <Badge variant={active ? 'success' : 'secondary'}>
                      {active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mb-1.5">{s.subtitle}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{s.description}</p>
                  {active && (
                    <p className="mt-2 text-xs font-medium" style={{ color: s.color }}>
                      {s.sentinel} is online
                    </p>
                  )}
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => toggle(s.code)}
                  disabled={isToggling}
                  className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors mt-1"
                  style={{ backgroundColor: active ? s.color : '#374151' }}
                >
                  {isToggling ? (
                    <Loader2
                      className="absolute top-0.5 h-5 w-5 animate-spin text-white"
                      style={{ left: active ? '22px' : '2px' }}
                    />
                  ) : (
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        active ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
