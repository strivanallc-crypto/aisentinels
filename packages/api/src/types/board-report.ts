/**
 * Board Performance Report types — Phase 9-A
 *
 * Monthly board-level ISO compliance report:
 *   - Compliance scores per standard
 *   - CAPAs summary + overdue items
 *   - Audit findings trend (3 months)
 *   - Document completion rates
 *   - Sentinel activity metrics
 *   - Claude-generated executive summary
 */

export interface BoardReportData {
  tenantId: string;
  orgName: string;
  reportPeriod: {
    from: string;     // ISO 8601 — first day of previous month
    to: string;       // ISO 8601 — last day of previous month
    label: string;    // e.g. "February 2026"
  };
  generatedAt: string;
  generatedBy: 'scheduled' | 'manual';

  complianceScores: {
    overall: number;        // 0-100
    byStandard: Array<{
      standard: string;     // 'ISO 9001' | 'ISO 14001' | 'ISO 45001'
      score: number;
      trend: 'up' | 'down' | 'stable';
      activeControls: number;
      totalControls: number;
    }>;
  };

  capasSummary: {
    total: number;
    open: number;
    inProgress: number;
    overdue: number;
    closedThisPeriod: number;
    overdueItems: Array<{
      id: string;
      title: string;
      daysOverdue: number;
      severity: string;
    }>;
  };

  auditFindings: {
    trend: Array<{
      month: string;        // e.g. "Dec 2025"
      major: number;
      minor: number;
      observations: number;
    }>;                     // last 3 months
    totalThisPeriod: number;
    closureRate: number;    // percentage
  };

  documentCompletion: {
    total: number;
    approved: number;
    draft: number;
    pendingApproval: number;
    completionRate: number;   // percentage
  };

  sentinelActivity: {
    totalInteractions: number;
    bySentinel: Array<{
      name: string;
      color: string;
      interactions: number;
      topAction: string;
    }>;
    mostActive: string;
  };

  executiveSummary: string;   // Claude-generated paragraph
}

export interface BoardReportRecord {
  id: string;
  tenantId: string;
  reportPeriod: string;       // 'YYYY-MM'
  status: 'generating' | 'ready' | 'failed';
  s3Key?: string;
  presignedUrl?: string;
  generatedAt?: string;
  generatedBy: 'scheduled' | 'manual';
  createdAt: string;
}
