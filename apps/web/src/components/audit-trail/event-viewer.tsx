'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auditTrailApi } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────
interface AuditEvent {
  tenantId: string;
  timestampEventId: string;
  actorId: string;
  createdAt: string;
  eventType: string;
  entityType: string;
  entityId: string;
  action: string;
  severity: string;
  detail?: Record<string, unknown>;
}

interface QueryResult {
  count: number;
  events: AuditEvent[];
  lastKey?: string;
}

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

// ── Severity badge variant ─────────────────────────────────────
function severityVariant(s: string): 'default' | 'warning' | 'destructive' | 'secondary' {
  switch (s) {
    case 'critical': return 'destructive';
    case 'warning':  return 'warning';
    case 'info':     return 'default';
    default:         return 'secondary';
  }
}

// ── Action → human label ───────────────────────────────────────
function formatAction(action: string): string {
  return action
    .replace(/([A-Z])/g, ' $1')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── Component ──────────────────────────────────────────────────
export function AuditEventViewer() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit] = useState(50);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditTrailApi.query({ limit });
      const data = res.data as QueryResult;
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Filtering ────────────────────────────────────────────────
  const filtered = events.filter((ev) => {
    if (severityFilter !== 'all' && ev.severity !== severityFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        ev.eventType.toLowerCase().includes(q) ||
        ev.entityType.toLowerCase().includes(q) ||
        ev.entityId.toLowerCase().includes(q) ||
        ev.actorId.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── Controls ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: 'var(--content-text-dim)' }}
          />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search events…"
            className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-gray-500 focus:border-indigo-500"
            style={{ borderColor: 'var(--content-border)', color: 'var(--content-text)' }}
          />
        </div>

        {/* Severity filter */}
        <div className="flex gap-1 rounded-lg border p-0.5" style={{ borderColor: 'var(--content-border)' }}>
          {(['all', 'info', 'warning', 'critical'] as SeverityFilter[]).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                severityFilter === sev
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <Button variant="ghost" size="sm" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ── Error ─────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────── */}
      {loading && events.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <Activity className="mx-auto h-8 w-8 mb-3" style={{ color: 'var(--content-text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
            {events.length === 0 ? 'No audit events yet.' : 'No events match your filters.'}
          </p>
        </div>
      )}

      {/* ── Event list ────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden divide-y"
          style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
        >
          {/* Column header */}
          <div
            className="grid gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--content-text-muted)',
              gridTemplateColumns: '140px 1fr 120px 100px 80px 24px',
              background: 'var(--content-bg)',
            }}
          >
            <span>Timestamp</span>
            <span>Event</span>
            <span>Entity</span>
            <span>Actor</span>
            <span>Severity</span>
            <span />
          </div>

          {filtered.map((ev) => {
            const isExpanded = expandedId === ev.timestampEventId;
            const date = new Date(ev.createdAt);
            const ts = date.toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            });

            return (
              <div key={ev.timestampEventId}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : ev.timestampEventId)}
                  className="grid w-full gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/[0.03]"
                  style={{
                    gridTemplateColumns: '140px 1fr 120px 100px 80px 24px',
                    color: 'var(--content-text)',
                  }}
                >
                  {/* Timestamp */}
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--content-text-dim)' }}>
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    {ts}
                  </span>

                  {/* Event type */}
                  <span className="truncate font-medium" title={ev.eventType}>
                    {formatAction(ev.eventType)}
                  </span>

                  {/* Entity */}
                  <span className="truncate" style={{ color: 'var(--content-text-dim)' }} title={ev.entityId}>
                    {ev.entityType}
                  </span>

                  {/* Actor */}
                  <span className="truncate" style={{ color: 'var(--content-text-dim)' }} title={ev.actorId}>
                    {ev.actorId.length > 12 ? ev.actorId.slice(0, 8) + '…' : ev.actorId}
                  </span>

                  {/* Severity */}
                  <span>
                    <Badge variant={severityVariant(ev.severity)} className="text-[10px]">
                      {ev.severity}
                    </Badge>
                  </span>

                  {/* Expand */}
                  <span className="flex items-center justify-center" style={{ color: 'var(--content-text-dim)' }}>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>

                {/* Detail panel */}
                {isExpanded && (
                  <div
                    className="px-4 pb-3 pt-0 text-xs space-y-1.5"
                    style={{ background: 'var(--content-bg)' }}
                  >
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 max-w-xl">
                      <DetailRow label="Event Type" value={ev.eventType} />
                      <DetailRow label="Action" value={ev.action} />
                      <DetailRow label="Entity Type" value={ev.entityType} />
                      <DetailRow label="Entity ID" value={ev.entityId} />
                      <DetailRow label="Actor ID" value={ev.actorId} />
                      <DetailRow label="Created At" value={ev.createdAt} />
                    </div>
                    {ev.detail && Object.keys(ev.detail).length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--content-text-muted)' }}>
                          Detail
                        </p>
                        <pre
                          className="rounded-lg border p-3 text-[11px] overflow-x-auto"
                          style={{
                            borderColor: 'var(--content-border)',
                            color: 'var(--content-text-dim)',
                            background: 'rgba(0,0,0,0.2)',
                            maxHeight: 200,
                          }}
                        >
                          {JSON.stringify(ev.detail, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-center text-[11px]" style={{ color: 'var(--content-text-dim)' }}>
          Showing {filtered.length} of {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ── Inline detail row ──────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium" style={{ color: 'var(--content-text-muted)', minWidth: 80 }}>
        {label}:
      </span>
      <span className="break-all" style={{ color: 'var(--content-text)' }}>
        {value}
      </span>
    </div>
  );
}
