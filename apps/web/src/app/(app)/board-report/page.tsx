'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Download,
  Loader2,
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { boardReportApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { BoardReportListItem } from '@/types/board-report';
import {
  SentinelPageHero,
  PrimaryButton,
  SadewaEmptyState,
  SectionLabel,
  ContentCard,
  PageSkeleton,
} from '@/components/ui/sentinel-page-hero';

const STATUS_COLORS: Record<string, string> = {
  ready: '#22C55E',
  generating: '#F59E0B',
  failed: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'Ready',
  generating: 'Generating',
  failed: 'Failed',
};

function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCurrentPeriod(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
}

export default function BoardReportPage() {
  const [reports, setReports] = useState<BoardReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const data = await boardReportApi.list();
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    const hasGenerating = reports.some((r) => r.status === 'generating');
    if (hasGenerating && !pollInterval) {
      const interval = setInterval(fetchReports, 5000);
      setPollInterval(interval);
    } else if (!hasGenerating && pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [reports, pollInterval, fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await boardReportApi.generate(getCurrentPeriod());
      if (result.presignedUrl) window.open(result.presignedUrl, '_blank');
      await fetchReports();
    } catch { /* silent */ } finally { setGenerating(false); }
  };

  const handleDownload = (url: string) => { window.open(url, '_blank'); };

  const readyCount = reports.filter((r) => r.status === 'ready').length;
  const totalCount = reports.length;

  return (
    <div className="p-6 max-w-[1280px]">
      <SentinelPageHero
        sectionLabel="BOARD REPORT"
        title="Monthly Intelligence. Board-Ready."
        subtitle="AI-generated executive summaries with compliance scores, CAPA status, and audit findings."
        sentinelColor="#3B82F6"
        stats={
          loading
            ? undefined
            : [
                { value: String(totalCount), label: 'Reports' },
                { value: String(readyCount), label: 'Ready' },
              ]
        }
      />

      <div className="flex items-center justify-between mb-6">
        <SectionLabel>REPORT HISTORY</SectionLabel>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <PrimaryButton onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate Report'}
          </PrimaryButton>
        </div>
      </div>

      <ContentCard>
        {loading ? (
          <PageSkeleton rows={5} />
        ) : reports.length === 0 ? (
          <SadewaEmptyState
            number="01"
            heading="No reports generated yet"
            description="Generate your first board performance report with AI-powered executive summaries."
            action={
              <PrimaryButton onClick={handleGenerate} disabled={generating}>
                <FileText className="h-4 w-4" /> Generate Report
              </PrimaryButton>
            }
          />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--row-divider)' }}>
            {reports.map((report, i) => {
              const color = STATUS_COLORS[report.status] ?? '#6b7280';
              const label = STATUS_LABELS[report.status] ?? report.status;
              const StatusIcon = report.status === 'ready' ? CheckCircle2 : report.status === 'generating' ? Clock : AlertCircle;
              return (
                <div key={report.reportId} className="flex items-center gap-4 px-4 py-4 transition-all duration-200 hover:bg-white/[0.03] hover:pl-5 group">
                  <span className="text-[12px] font-semibold font-heading w-8 flex-shrink-0 tabular-nums transition-colors group-hover:text-white/25" style={{ color: 'var(--row-number)' }}>/{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold">{formatPeriod(report.period)}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{formatDate(report.generatedAt)}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0" style={{ color: report.generatedBy === 'scheduled' ? '#818CF8' : 'var(--muted)', background: report.generatedBy === 'scheduled' ? 'rgba(99,102,241,0.1)' : 'var(--surface)' }}>
                    {report.generatedBy === 'scheduled' ? 'Scheduled' : 'Manual'}
                  </span>
                  <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0" style={{ color, background: `${color}1a` }}>
                    <StatusIcon className="h-3 w-3" /> {label}
                  </span>
                  {report.status === 'ready' && report.presignedUrl ? (
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(report.presignedUrl!)} className="gap-1.5 flex-shrink-0">
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                  ) : report.status === 'generating' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: '#F59E0B' }} />
                  ) : (
                    <span className="w-10" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ContentCard>

      {/* Info card */}
      <ContentCard className="mt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <FileText className="h-4 w-4" style={{ color: '#818CF8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#818CF8' }}>Automated Monthly Reports</p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              Board reports are automatically generated on the 1st of every month at 08:00 UTC.
              Each report includes compliance scores, CAPA status, audit findings, document completion,
              and an AI-generated executive summary.
            </p>
          </div>
        </div>
      </ContentCard>
    </div>
  );
}
