/**
 * POST /api/v1/board-report/scheduled (EventBridge invocation)
 *
 * Triggered by EventBridge on 1st of month 08:00 UTC.
 * NOT JWT protected — EventBridge invocation only.
 *
 * Flow:
 *   1. Query all active tenants (had activity in last 90 days)
 *   2. For each tenant: generate board report (direct function call)
 *   3. Return summary: { processed, succeeded, failed }
 *
 * Max concurrency: process 5 tenants at a time (chunked Promise.all)
 * Never throws — always returns summary.
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createDb } from '@aisentinels/db';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { aggregateBoardData } from '../../lib/board-report-data.ts';
import { generateExecutiveSummary } from '../../lib/board-report-summary.ts';
import { renderBoardReportPDF } from '../../lib/board-report-pdf.ts';
import type { BoardReportData } from '../../types/board-report.ts';

// ── Env + Clients ───────────────────────────────────────────────────────────

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const EXPORTS_BUCKET = process.env.EXPORTS_BUCKET ?? `aisentinels-exports-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

const CHUNK_SIZE = 5;

// ── Helper ──────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getLastMonthPeriod() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastMonth.getFullYear();
  const month = lastMonth.getMonth() + 1;
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
  const label = new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { from, to, label, key };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function scheduled(_event: APIGatewayProxyEventV2) {
  const { client } = await getDb();
  const period = getLastMonthPeriod();

  // 1. Find all active tenants (had document activity in last 90 days)
  let tenantIds: string[];
  try {
    const rows = await client`
      SELECT DISTINCT tenant_id
      FROM documents
      WHERE created_at > NOW() - INTERVAL '90 days'
    `;
    tenantIds = rows.map((r) => r.tenant_id as string);
  } catch (err) {
    console.error('Failed to query active tenants:', err);
    return json(500, { error: 'Failed to query active tenants', processed: 0, succeeded: 0, failed: 0 });
  }

  if (tenantIds.length === 0) {
    return json(200, { message: 'No active tenants found', processed: 0, succeeded: 0, failed: 0 });
  }

  console.log(JSON.stringify({
    event: 'BoardReportScheduled',
    period: period.key,
    tenantCount: tenantIds.length,
  }));

  let succeeded = 0;
  let failed = 0;

  // 2. Process tenants in chunks of 5
  for (let i = 0; i < tenantIds.length; i += CHUNK_SIZE) {
    const chunk = tenantIds.slice(i, i + CHUNK_SIZE);

    const results = await Promise.allSettled(
      chunk.map((tenantId) => generateForTenant(client, tenantId, period)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        succeeded++;
      } else {
        failed++;
        console.error('Tenant report failed:', result.reason);
      }
    }
  }

  console.log(JSON.stringify({
    event: 'BoardReportScheduledComplete',
    period: period.key,
    processed: tenantIds.length,
    succeeded,
    failed,
  }));

  return json(200, { processed: tenantIds.length, succeeded, failed });
}

// ── Per-tenant generation ────────────────────────────────────────────────────

async function generateForTenant(
  client: Awaited<ReturnType<typeof createDb>>['client'],
  tenantId: string,
  period: { from: string; to: string; label: string; key: string },
): Promise<void> {
  // Check if already generated
  const existingRows = await client`
    SELECT id, status FROM board_reports
    WHERE tenant_id = ${tenantId} AND report_period = ${period.key}
    LIMIT 1
  `;
  if (existingRows.length > 0 && existingRows[0]!.status === 'ready') {
    console.log(`Board report already exists for tenant=${tenantId} period=${period.key}`);
    return;
  }

  // Delete failed record if exists
  if (existingRows.length > 0) {
    await client`DELETE FROM board_reports WHERE id = ${existingRows[0]!.id}::uuid`;
  }

  // Insert new record
  const insertRows = await client`
    INSERT INTO board_reports (tenant_id, report_period, generated_by)
    VALUES (${tenantId}, ${period.key}, 'scheduled')
    RETURNING id
  `;
  const reportId = insertRows[0]!.id as string;

  try {
    // Aggregate data
    const reportData = await aggregateBoardData(client, tenantId, {
      from: period.from,
      to: period.to,
      label: period.label,
    });

    // Executive summary
    const executiveSummary = await generateExecutiveSummary(reportData);

    const fullData: BoardReportData = { ...reportData, executiveSummary };

    // Render PDF
    const pdfBuffer = await renderBoardReportPDF(fullData);

    // Upload to S3
    const s3Key = `board-reports/${tenantId}/${period.key}/board-report-${period.key}.pdf`;
    await s3.send(new PutObjectCommand({
      Bucket: EXPORTS_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    }));

    // Update record
    const generatedAt = new Date().toISOString();
    await client`
      UPDATE board_reports
      SET status = 'ready', s3_key = ${s3Key}, generated_at = ${generatedAt}::timestamptz
      WHERE id = ${reportId}::uuid
    `;

    // Audit event
    logAuditEvent({
      eventType: 'board.report.generated',
      entityType: 'document',
      entityId: reportId,
      actorId: 'system:eventbridge',
      tenantId,
      action: 'GENERATE',
      detail: { period: period.key, generatedBy: 'scheduled' },
    });

    console.log(`Board report generated: tenant=${tenantId} period=${period.key} reportId=${reportId}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await client`
      UPDATE board_reports
      SET status = 'failed', error_message = ${errorMessage}
      WHERE id = ${reportId}::uuid
    `.catch(() => { /* best-effort */ });
    throw err;
  }
}
