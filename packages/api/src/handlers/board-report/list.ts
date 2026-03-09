/**
 * GET /api/v1/board-report/list
 *
 * Returns the last 12 board reports for the authenticated tenant.
 * For reports with status='ready', generates fresh presigned S3 URLs (1hr expiry).
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';
import type { BoardReportRecord } from '../../types/board-report.ts';

// ── Env + Clients ───────────────────────────────────────────────────────────

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const EXPORTS_BUCKET = process.env.EXPORTS_BUCKET ?? `aisentinels-exports-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function listReports(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const { client } = await getDb();

  const rows = await client`
    SELECT id, tenant_id, report_period, status, s3_key, generated_at, generated_by, created_at
    FROM board_reports
    WHERE tenant_id = ${tenantId}
    ORDER BY report_period DESC
    LIMIT 12
  `;

  // Generate fresh presigned URLs for 'ready' reports
  const reports: BoardReportRecord[] = await Promise.all(
    rows.map(async (r) => {
      let presignedUrl: string | undefined;

      if (r.status === 'ready' && r.s3_key) {
        try {
          presignedUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: EXPORTS_BUCKET, Key: r.s3_key as string }),
            { expiresIn: 3600 },
          );
        } catch {
          // Presign failure is non-fatal — return report without URL
        }
      }

      return {
        id: r.id as string,
        tenantId: r.tenant_id as string,
        reportPeriod: r.report_period as string,
        status: r.status as BoardReportRecord['status'],
        s3Key: r.s3_key as string | undefined,
        presignedUrl,
        generatedAt: r.generated_at ? (r.generated_at as Date).toISOString() : undefined,
        generatedBy: r.generated_by as BoardReportRecord['generatedBy'],
        createdAt: (r.created_at as Date).toISOString(),
      };
    }),
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reports),
  };
}
