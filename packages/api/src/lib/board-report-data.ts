/**
 * Board Report Data Aggregator — Phase 9-A
 *
 * Queries Aurora + DynamoDB to build BoardReportData (minus executiveSummary).
 * Uses raw SQL via postgres tagged templates (tables not in Drizzle schema)
 * and DynamoDB DocumentClient for sentinel activity from audit events.
 *
 * All queries return empty/zero defaults on error — NEVER throw.
 */
import type postgres from 'postgres';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { BoardReportData } from '../types/board-report.ts';

// ── DynamoDB client (singleton) ──────────────────────────────────────────────
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const AUDIT_TABLE = process.env.AUDIT_EVENTS_TABLE_NAME ?? '';

// ── Sentinel metadata ────────────────────────────────────────────────────────
const SENTINEL_META: Record<string, { name: string; color: string }> = {
  'ai.document-generate': { name: 'Doki', color: '#8b5cf6' },
  'ai.clause-classify':   { name: 'Qualy', color: '#6366f1' },
  'ai.audit-plan':        { name: 'Qualy', color: '#6366f1' },
  'ai.audit-examine':     { name: 'Qualy', color: '#6366f1' },
  'ai.audit-report':      { name: 'Qualy', color: '#6366f1' },
  'ai.root-cause':        { name: 'Qualy', color: '#6366f1' },
  'ai.gap-detect':        { name: 'Envi', color: '#22c55e' },
  'ai.management-review': { name: 'Qualy', color: '#6366f1' },
  'omni.orchestrate':     { name: 'Omni', color: '#f59e0b' },
};

// ── Main aggregator ──────────────────────────────────────────────────────────

export async function aggregateBoardData(
  client: postgres.Sql,
  tenantId: string,
  period: { from: string; to: string; label: string },
): Promise<Omit<BoardReportData, 'executiveSummary'>> {
  const [
    complianceScores,
    capasSummary,
    auditFindings,
    documentCompletion,
    sentinelActivity,
    orgName,
  ] = await Promise.all([
    queryComplianceScores(client, tenantId),
    queryCapasSummary(client, tenantId, period),
    queryAuditFindings(client, tenantId),
    queryDocumentCompletion(client, tenantId),
    querySentinelActivity(tenantId, period),
    queryOrgName(client, tenantId),
  ]);

  return {
    tenantId,
    orgName,
    reportPeriod: period,
    generatedAt: new Date().toISOString(),
    generatedBy: 'manual',
    complianceScores,
    capasSummary,
    auditFindings,
    documentCompletion,
    sentinelActivity,
  };
}

// ── 1. Compliance Scores ─────────────────────────────────────────────────────

async function queryComplianceScores(
  client: postgres.Sql,
  tenantId: string,
): Promise<BoardReportData['complianceScores']> {
  try {
    const rows = await client`
      SELECT standard, COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)::int AS approved
      FROM documents
      WHERE tenant_id = ${tenantId}
        AND standard IS NOT NULL
      GROUP BY standard
    `;

    const byStandard = rows.map((r) => {
      const total = (r.total as number) || 1;
      const approved = (r.approved as number) || 0;
      const score = Math.round((approved / total) * 100);
      return {
        standard: r.standard as string,
        score,
        trend: 'stable' as const,
        activeControls: approved,
        totalControls: total,
      };
    });

    const overall =
      byStandard.length > 0
        ? Math.round(byStandard.reduce((sum, s) => sum + s.score, 0) / byStandard.length)
        : 0;

    return { overall, byStandard };
  } catch (err) {
    console.error('ComplianceScores query failed:', err);
    return { overall: 0, byStandard: [] };
  }
}

// ── 2. CAPAs Summary ────────────────────────────────────────────────────────

async function queryCapasSummary(
  client: postgres.Sql,
  tenantId: string,
  period: { from: string; to: string },
): Promise<BoardReportData['capasSummary']> {
  try {
    const statusRows = await client`
      SELECT status, COUNT(*)::int AS count
      FROM capa
      WHERE tenant_id = ${tenantId}
      GROUP BY status
    `;

    const overdueRows = await client`
      SELECT id, title,
        EXTRACT(DAY FROM NOW() - due_date)::int AS days_overdue,
        severity
      FROM capa
      WHERE tenant_id = ${tenantId}
        AND due_date < NOW()
        AND status NOT IN ('closed')
      ORDER BY due_date ASC
      LIMIT 5
    `;

    const closedRows = await client`
      SELECT COUNT(*)::int AS count
      FROM capa
      WHERE tenant_id = ${tenantId}
        AND status = 'closed'
        AND updated_at >= ${period.from}::timestamptz
        AND updated_at < ${period.to}::timestamptz
    `;

    let total = 0, open = 0, inProgress = 0;
    for (const r of statusRows) {
      const count = r.count as number;
      total += count;
      if (r.status === 'open') open = count;
      if (r.status === 'in_progress') inProgress = count;
    }

    return {
      total,
      open,
      inProgress,
      overdue: overdueRows.length,
      closedThisPeriod: (closedRows[0]?.count as number) ?? 0,
      overdueItems: overdueRows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        daysOverdue: (r.days_overdue as number) ?? 0,
        severity: (r.severity as string) ?? 'medium',
      })),
    };
  } catch (err) {
    console.error('CAPAs query failed:', err);
    return { total: 0, open: 0, inProgress: 0, overdue: 0, closedThisPeriod: 0, overdueItems: [] };
  }
}

// ── 3. Audit Findings Trend (last 3 months) ──────────────────────────────────

async function queryAuditFindings(
  client: postgres.Sql,
  tenantId: string,
): Promise<BoardReportData['auditFindings']> {
  try {
    const rows = await client`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
        finding_type,
        COUNT(*)::int AS count
      FROM audit_findings
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '3 months'
      GROUP BY DATE_TRUNC('month', created_at), finding_type
      ORDER BY DATE_TRUNC('month', created_at)
    `;

    // Pivot: group by month
    const monthMap = new Map<string, { major: number; minor: number; observations: number }>();
    for (const r of rows) {
      const month = r.month as string;
      if (!monthMap.has(month)) monthMap.set(month, { major: 0, minor: 0, observations: 0 });
      const entry = monthMap.get(month)!;
      const ft = (r.finding_type as string)?.toLowerCase() ?? '';
      const count = r.count as number;
      if (ft === 'major') entry.major += count;
      else if (ft === 'minor') entry.minor += count;
      else entry.observations += count;
    }

    const trend = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    }));

    const totalThisPeriod = trend.length > 0
      ? trend[trend.length - 1]!.major + trend[trend.length - 1]!.minor + trend[trend.length - 1]!.observations
      : 0;

    // Closure rate: closed findings / total findings this period
    const closedRows = await client`
      SELECT COUNT(*)::int AS count
      FROM audit_findings
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '1 month'
        AND status = 'closed'
    `;
    const totalRows = await client`
      SELECT COUNT(*)::int AS count
      FROM audit_findings
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '1 month'
    `;
    const closed = (closedRows[0]?.count as number) ?? 0;
    const totalPeriod = (totalRows[0]?.count as number) ?? 1;
    const closureRate = totalPeriod > 0 ? Math.round((closed / totalPeriod) * 100) : 0;

    return { trend, totalThisPeriod, closureRate };
  } catch (err) {
    console.error('AuditFindings query failed:', err);
    return { trend: [], totalThisPeriod: 0, closureRate: 0 };
  }
}

// ── 4. Document Completion ───────────────────────────────────────────────────

async function queryDocumentCompletion(
  client: postgres.Sql,
  tenantId: string,
): Promise<BoardReportData['documentCompletion']> {
  try {
    const rows = await client`
      SELECT status, COUNT(*)::int AS count
      FROM documents
      WHERE tenant_id = ${tenantId}
      GROUP BY status
    `;

    let total = 0, approved = 0, draft = 0, pendingApproval = 0;
    for (const r of rows) {
      const count = r.count as number;
      total += count;
      if (r.status === 'approved') approved = count;
      else if (r.status === 'draft') draft = count;
      else if (r.status === 'pending_approval') pendingApproval = count;
    }

    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, draft, pendingApproval, completionRate };
  } catch (err) {
    console.error('DocumentCompletion query failed:', err);
    return { total: 0, approved: 0, draft: 0, pendingApproval: 0, completionRate: 0 };
  }
}

// ── 5. Sentinel Activity (DynamoDB audit events) ─────────────────────────────

async function querySentinelActivity(
  tenantId: string,
  period: { from: string; to: string },
): Promise<BoardReportData['sentinelActivity']> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: AUDIT_TABLE,
      KeyConditionExpression: 'tenantId = :tid AND timestampEventId BETWEEN :sk1 AND :sk2',
      ExpressionAttributeValues: {
        ':tid': tenantId,
        ':sk1': `EVENT#${period.from}`,
        ':sk2': `EVENT#${period.to}~`,
      },
      ProjectionExpression: 'eventType',
      Limit: 500,
    }));

    const items = result.Items ?? [];
    const sentinelCounts = new Map<string, { count: number; actions: Map<string, number> }>();

    for (const item of items) {
      const eventType = item.eventType as string;
      if (!eventType) continue;

      // Match against sentinel metadata
      const meta = SENTINEL_META[eventType];
      if (!meta) continue;

      if (!sentinelCounts.has(meta.name)) {
        sentinelCounts.set(meta.name, { count: 0, actions: new Map() });
      }
      const entry = sentinelCounts.get(meta.name)!;
      entry.count++;
      entry.actions.set(eventType, (entry.actions.get(eventType) ?? 0) + 1);
    }

    const bySentinel = Array.from(sentinelCounts.entries()).map(([name, data]) => {
      // Find top action
      let topAction = '';
      let topCount = 0;
      for (const [action, count] of data.actions) {
        if (count > topCount) {
          topAction = action;
          topCount = count;
        }
      }
      // Find color from meta
      const color = Object.values(SENTINEL_META).find((m) => m.name === name)?.color ?? '#6366f1';
      return { name, color, interactions: data.count, topAction };
    }).sort((a, b) => b.interactions - a.interactions);

    const totalInteractions = bySentinel.reduce((sum, s) => sum + s.interactions, 0);
    const mostActive = bySentinel[0]?.name ?? 'None';

    return { totalInteractions, bySentinel, mostActive };
  } catch (err) {
    console.error('SentinelActivity query failed:', err);
    return { totalInteractions: 0, bySentinel: [], mostActive: 'None' };
  }
}

// ── Org name helper ──────────────────────────────────────────────────────────

async function queryOrgName(
  client: postgres.Sql,
  tenantId: string,
): Promise<string> {
  try {
    const rows = await client`
      SELECT name FROM organizations WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    return (rows[0]?.name as string) ?? 'Organization';
  } catch {
    return 'Organization';
  }
}
