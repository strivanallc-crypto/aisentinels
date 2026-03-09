/**
 * Board Report — Frontend Types (Phase 9-B)
 *
 * Mirrors backend BoardReportRecord from packages/api/src/types/board-report.ts
 * but only includes fields the UI actually needs.
 */

export interface BoardReportListItem {
  reportId: string;
  period: string;          // 'YYYY-MM'
  status: 'generating' | 'ready' | 'failed';
  generatedAt: string | null;
  generatedBy: 'scheduled' | 'manual';
  presignedUrl?: string;
}

export interface GenerateReportResponse {
  reportId: string;
  presignedUrl?: string;
  period: string;
  generatedAt?: string;
  cached?: boolean;
  status?: string;
}
