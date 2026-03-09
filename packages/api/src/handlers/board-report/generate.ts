/**
 * POST /api/v1/board-report/generate
 *
 * Generates a monthly board performance report:
 *   1. Aggregate data from Aurora + DynamoDB
 *   2. Claude executive summary (Omni persona)
 *   3. Puppeteer HTML → PDF render
 *   4. Upload PDF to S3 exports bucket
 *   5. Return presigned GET URL (1hr expiry)
 *
 * If a report already exists for the requested period with status='ready',
 * returns the existing presigned URL without regenerating.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { aggregateBoardData } from '../../lib/board-report-data.ts';
import { generateExecutiveSummary } from '../../lib/board-report-summary.ts';
import { renderBoardReportPDF } from '../../lib/board-report-pdf.ts';
import type { BoardReportData } from '../../types/board-report.ts';
import { sendEmail, TEAM_ALL } from '../../lib/mailer.ts';
import { boardReportReadyTemplate } from '../../lib/email-templates.ts';

// ── Env + Clients ───────────────────────────────────────────────────────────

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const EXPORTS_BUCKET = process.env.EXPORTS_BUCKET ?? `aisentinels-exports-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Zod schema ──────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

// ── Helper ──────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function computePeriod(periodStr?: string): { from: string; to: string; label: string; key: string } {
  let year: number;
  let month: number;

  if (periodStr) {
    const [y, m] = periodStr.split('-').map(Number);
    year = y!;
    month = m!;
  } else {
    // Default to last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = lastMonth.getFullYear();
    month = lastMonth.getMonth() + 1;
  }

  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
  const label = new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const key = `${year}-${String(month).padStart(2, '0')}`;

  return { from, to, label, key };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function generate(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const parsed = parseBody(GenerateSchema, event.body);
  if ('statusCode' in parsed) return parsed;

  const period = computePeriod(parsed.data.period);
  const { client } = await getDb();

  // Check if report already exists for this period
  const existingRows = await client`
    SELECT id, status, s3_key, generated_at
    FROM board_reports
    WHERE tenant_id = ${tenantId} AND report_period = ${period.key}
    LIMIT 1
  `;

  if (existingRows.length > 0) {
    const existing = existingRows[0]!;
    if (existing.status === 'ready' && existing.s3_key) {
      // Generate fresh presigned URL for existing report
      const presignedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: EXPORTS_BUCKET, Key: existing.s3_key as string }),
        { expiresIn: 3600 },
      );
      return json(200, {
        reportId: existing.id,
        presignedUrl,
        period: period.key,
        generatedAt: existing.generated_at,
        cached: true,
      });
    }
    if (existing.status === 'generating') {
      return json(202, { reportId: existing.id, status: 'generating', period: period.key });
    }
    // If failed, allow regeneration — delete the old record
    await client`DELETE FROM board_reports WHERE id = ${existing.id}::uuid`;
  }

  // Insert new record with status='generating'
  const insertRows = await client`
    INSERT INTO board_reports (tenant_id, report_period, generated_by)
    VALUES (${tenantId}, ${period.key}, 'manual')
    RETURNING id, created_at
  `;
  const reportId = insertRows[0]!.id as string;

  try {
    // 1. Aggregate data from Aurora + DynamoDB
    const reportData = await aggregateBoardData(client, tenantId, {
      from: period.from,
      to: period.to,
      label: period.label,
    });

    // 2. Claude executive summary
    const executiveSummary = await generateExecutiveSummary(reportData);

    const fullData: BoardReportData = {
      ...reportData,
      executiveSummary,
    };

    // 3. Render PDF
    const pdfBuffer = await renderBoardReportPDF(fullData);

    // 4. Upload to S3
    const s3Key = `board-reports/${tenantId}/${period.key}/board-report-${period.key}.pdf`;

    await s3.send(new PutObjectCommand({
      Bucket: EXPORTS_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    }));

    // 5. Generate presigned GET URL (1 hour)
    const presignedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: EXPORTS_BUCKET, Key: s3Key }),
      { expiresIn: 3600 },
    );

    // 6. Update record: status='ready'
    const generatedAt = new Date().toISOString();
    await client`
      UPDATE board_reports
      SET status = 'ready', s3_key = ${s3Key}, generated_at = ${generatedAt}::timestamptz
      WHERE id = ${reportId}::uuid
    `;

    // 7. Audit event (fire-and-forget)
    logAuditEvent({
      eventType: 'board.report.generated',
      entityType: 'document',
      entityId: reportId,
      actorId: sub,
      tenantId,
      action: 'GENERATE',
      detail: { period: period.key, generatedBy: 'manual' },
    });

    // 8. Board report ready email (fire-and-forget)
    const emailData = boardReportReadyTemplate({ periodLabel: period.label, presignedUrl });
    sendEmail({ ...emailData, to: sub, cc: TEAM_ALL });

    return json(200, { reportId, presignedUrl, period: period.key, generatedAt });
  } catch (err) {
    // On any failure: mark as failed
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Board report generation failed:', errorMessage);

    await client`
      UPDATE board_reports
      SET status = 'failed', error_message = ${errorMessage}
      WHERE id = ${reportId}::uuid
    `.catch(() => { /* best-effort */ });

    return json(500, { error: 'Report generation failed', reportId });
  }
}
