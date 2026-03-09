'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Loader2,
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { boardReportApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { BoardReportListItem } from '@/types/board-report';

/* ─── Status config ─── */
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive'; icon: React.ElementType }> = {
  ready:      { label: 'Ready',      variant: 'success',     icon: CheckCircle2 },
  generating: { label: 'Generating', variant: 'warning',     icon: Clock },
  failed:     { label: 'Failed',     variant: 'destructive', icon: AlertCircle },
};

/* ─── Helpers ─── */
function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getCurrentPeriod(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
}

/* ─── Page ─── */
export default function BoardReportPage() {
  const [reports, setReports] = useState<BoardReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const data = await boardReportApi.list();
      setReports(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Poll while any report is generating
  useEffect(() => {
    const hasGenerating = reports.some((r) => r.status === 'generating');
    if (hasGenerating && !pollInterval) {
      const interval = setInterval(fetchReports, 5000);
      setPollInterval(interval);
    } else if (!hasGenerating && pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [reports, pollInterval, fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await boardReportApi.generate(getCurrentPeriod());
      if (result.presignedUrl) {
        window.open(result.presignedUrl, '_blank');
      }
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl" style={{ color: 'var(--content-text)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--content-text-muted)' }}
          >
            ISO Platform › Board Report
          </p>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" style={{ color: 'var(--sentinel-accent)' }} />
            Board Performance Report
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Monthly board-level ISO compliance reports with AI executive summary
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generating ? 'Generating…' : 'Generate Report'}
        </Button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
          }}
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#EF4444' }} />
          <p className="text-sm" style={{ color: '#FCA5A5' }}>{error}</p>
        </div>
      )}

      {/* ── Reports table ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--content-border)' }}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
            <span className="text-sm font-semibold">Report History</span>
          </div>
          <button
            onClick={fetchReports}
            className="text-xs flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: 'var(--content-text-muted)' }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--content-text-dim)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--content-text)' }}>
              No reports generated yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--content-text-dim)' }}>
              Click &quot;Generate Report&quot; to create your first board performance report.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--content-border)' }}>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                  Period
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                  Generated
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                  Source
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.failed!;
                const StatusIcon = statusCfg.icon;
                return (
                  <tr
                    key={report.reportId}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: '1px solid var(--content-border)' }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--content-text-muted)' }} />
                        <span className="font-medium">{formatPeriod(report.period)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusCfg.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--content-text-dim)' }}>
                      {formatDate(report.generatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background: report.generatedBy === 'scheduled' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)',
                          color: report.generatedBy === 'scheduled' ? '#818CF8' : 'var(--content-text-dim)',
                        }}
                      >
                        {report.generatedBy === 'scheduled' ? 'Scheduled' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {report.status === 'ready' && report.presignedUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(report.presignedUrl!)}
                          className="gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </Button>
                      ) : report.status === 'generating' ? (
                        <span className="text-xs flex items-center justify-end gap-1.5" style={{ color: 'var(--content-text-dim)' }}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Processing…
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Info card ── */}
      <div
        className="rounded-xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'rgba(99,102,241,0.15)' }}
        >
          <BarChart3 className="h-4 w-4" style={{ color: '#818CF8' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#818CF8' }}>
            Automated Monthly Reports
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--content-text-dim)' }}>
            Board reports are automatically generated on the 1st of every month at 08:00 UTC.
            Each report includes compliance scores, CAPA status, audit findings, document completion,
            and an AI-generated executive summary powered by Omni.
          </p>
        </div>
      </div>
    </div>
  );
}
