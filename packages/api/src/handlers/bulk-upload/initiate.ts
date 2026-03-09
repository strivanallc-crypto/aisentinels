/**
 * POST /api/v1/bulk-upload/initiate
 *
 * Creates a bulk upload batch and returns presigned S3 PUT URLs
 * for each file. Client uploads files directly to S3 using these URLs,
 * then calls POST /bulk-upload/process with the item IDs.
 *
 * Validations:
 *   - Max 10 files per batch
 *   - Max 25MB per file
 *   - Only PDF and DOCX accepted
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import {
  BULK_LIMITS,
  type BulkInitiateResponse,
} from '../../types/bulk-upload.ts';

// ── Env + Clients ───────────────────────────────────────────────────────────

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const BUCKET = process.env.WORKING_FILES_BUCKET ?? `aisentinels-working-files-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Zod schema ──────────────────────────────────────────────────────────────

const BulkInitiateSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(500),
        fileType: z.enum(BULK_LIMITS.ALLOWED_TYPES),
        fileSize: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(BULK_LIMITS.MAX_FILES),
});

// ── Mime type map ───────────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// ── Helper ──────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function initiate(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Parse + validate
  const parsed = parseBody(BulkInitiateSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { files } = parsed.data;

  // Enforce per-file size limit
  for (const file of files) {
    if (file.fileSize > BULK_LIMITS.MAX_FILE_SIZE_BYTES) {
      return json(400, {
        error: `File "${file.filename}" exceeds 25MB limit`,
      });
    }
  }

  // Create batch + items in Aurora (raw SQL — tables are not in Drizzle schema)
  const { client } = await getDb();

  // 1. Insert batch
  const batchRows = await client`
    INSERT INTO bulk_upload_batches (tenant_id, created_by, total_files)
    VALUES (${tenantId}, ${sub}, ${files.length})
    RETURNING id, created_at
  `;
  const batchId = batchRows[0]!.id as string;

  // 2. Insert items
  const itemRows = await client`
    INSERT INTO bulk_upload_items ${client(
      files.map((f) => ({
        batch_id: batchId,
        tenant_id: tenantId,
        filename: f.filename,
        file_type: f.fileType,
        file_size: f.fileSize,
      })),
    )}
    RETURNING id, filename
  `;

  // 3. Generate presigned PUT URLs for each item
  const responseItems: BulkInitiateResponse['items'] = [];

  for (const row of itemRows) {
    const itemId = row.id as string;
    const filename = row.filename as string;
    const file = files.find((f) => f.filename === filename)!;
    const s3Key = `bulk/${tenantId}/${batchId}/${itemId}/${filename}`;

    // Update item with s3_key
    await client`
      UPDATE bulk_upload_items SET s3_key = ${s3Key} WHERE id = ${itemId}::uuid
    `;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: MIME_MAP[file.fileType] ?? 'application/octet-stream',
    });
    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: BULK_LIMITS.PRESIGNED_URL_EXPIRY,
    });

    responseItems.push({
      itemId,
      filename,
      presignedUrl,
      expiresIn: 900 as const,
    });
  }

  // Audit event (fire-and-forget)
  logAuditEvent({
    eventType: 'bulk.upload.initiated',
    entityType: 'document',
    entityId: batchId,
    actorId: sub,
    tenantId,
    action: 'CREATE',
    detail: {
      totalFiles: files.length,
      fileTypes: [...new Set(files.map((f) => f.fileType))],
    },
    severity: 'info',
  });

  const response: BulkInitiateResponse = {
    batchId,
    items: responseItems,
  };

  return json(201, response);
}
