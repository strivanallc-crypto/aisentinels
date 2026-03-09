/**
 * GET /api/v1/bulk-upload/batch/:batchId
 *
 * Returns the full batch status with all items. Used by the frontend
 * to poll progress during file processing.
 *
 * Cross-tenant protection: batch must belong to the caller's tenant.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';
import type { BulkUploadBatch, BulkUploadItem } from '../../types/bulk-upload.ts';

// ── DB singleton ────────────────────────────────────────────────────────────

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Helper ──────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function batchStatus(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  // Extract batchId from path:  /api/v1/bulk-upload/batch/{batchId}
  const segments = event.rawPath.split('/');
  const batchId = segments[segments.length - 1];
  if (!batchId || batchId.length < 30) {
    return json(400, { error: 'Invalid batch ID' });
  }

  const { client } = await getDb();

  // Query batch — cross-tenant protection
  const batchRows = await client`
    SELECT id, tenant_id, created_by, status, total_files, processed,
           succeeded, failed, created_at, completed_at, metadata
    FROM bulk_upload_batches
    WHERE id = ${batchId}::uuid AND tenant_id = ${tenantId}
  `;

  if (batchRows.length === 0) {
    return json(404, { error: 'Batch not found' });
  }

  const batchRow = batchRows[0]!;

  // Query all items for this batch
  const itemRows = await client`
    SELECT id, batch_id, tenant_id, filename, file_type, file_size, s3_key,
           status, document_id, sentinel, iso_standard, error_message,
           created_at, processed_at
    FROM bulk_upload_items
    WHERE batch_id = ${batchId}::uuid AND tenant_id = ${tenantId}
    ORDER BY created_at ASC
  `;

  // Map DB rows to typed response
  const items: BulkUploadItem[] = itemRows.map((row) => ({
    id: row.id as string,
    batchId: row.batch_id as string,
    tenantId: row.tenant_id as string,
    filename: row.filename as string,
    fileType: row.file_type as 'pdf' | 'docx',
    fileSize: (row.file_size as number) ?? undefined,
    s3Key: (row.s3_key as string) ?? undefined,
    status: row.status as BulkUploadItem['status'],
    documentId: (row.document_id as string) ?? undefined,
    sentinel: (row.sentinel as string) ?? undefined,
    isoStandard: (row.iso_standard as string) ?? undefined,
    errorMessage: (row.error_message as string) ?? undefined,
    createdAt: (row.created_at as Date).toISOString(),
    processedAt: row.processed_at
      ? (row.processed_at as Date).toISOString()
      : undefined,
  }));

  const batch: BulkUploadBatch = {
    id: batchRow.id as string,
    tenantId: batchRow.tenant_id as string,
    createdBy: batchRow.created_by as string,
    status: batchRow.status as BulkUploadBatch['status'],
    totalFiles: batchRow.total_files as number,
    processed: batchRow.processed as number,
    succeeded: batchRow.succeeded as number,
    failed: batchRow.failed as number,
    createdAt: (batchRow.created_at as Date).toISOString(),
    completedAt: batchRow.completed_at
      ? (batchRow.completed_at as Date).toISOString()
      : undefined,
    items,
  };

  return json(200, batch);
}
