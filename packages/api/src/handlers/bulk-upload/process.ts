/**
 * POST /api/v1/bulk-upload/process
 *
 * Called AFTER the client has uploaded files to S3 via presigned URLs.
 * For each item:
 *   1. Verify file exists in S3 (HeadObject)
 *   2. Extract text from PDF/DOCX
 *   3. Omni triage — classify via Gemini (ISO standard, sentinel, category)
 *   4. Create document record in Aurora documents table
 *   5. Update bulk_upload_items with results
 *
 * Uses Promise.allSettled for parallel processing.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { callGemini } from '../../lib/gemini.ts';
import type { BulkUploadItem } from '../../types/bulk-upload.ts';

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

const BulkProcessSchema = z.object({
  batchId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(10),
});

// ── Text extraction ─────────────────────────────────────────────────────────

async function extractText(s3Key: string, fileType: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  const response = await s3.send(command);
  const body = await response.Body?.transformToByteArray();
  if (!body) throw new Error('Empty S3 object');

  if (fileType === 'pdf') {
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default
      ?? (pdfModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
    const result = await pdfParse(Buffer.from(body));
    return result.text;
  }

  if (fileType === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(body) });
    return result.value;
  }

  return new TextDecoder().decode(body);
}

// ── Omni triage — Gemini classification ─────────────────────────────────────

interface TriageResult {
  isoStandard: string;
  sentinel: string;
  category: string;
  confidence: number;
}

async function triageDocument(
  filename: string,
  textContent: string,
  tenantId: string,
): Promise<TriageResult> {
  const result = await callGemini({
    systemPrompt: `You are an ISO management system document classifier for AI Sentinels.
Your job is to classify uploaded documents into the correct ISO standard and assign them
to the appropriate AI Sentinel for processing.

Sentinels:
- Qualy: ISO 9001 (Quality Management)
- Envi: ISO 14001 (Environmental Management)
- Saffy: ISO 45001 (Occupational Health & Safety)
- Doki: General document management (when standard is unclear)

Document categories match the doc_type enum: policy, procedure, work_instruction, form, record, manual, plan, specification, external.`,
    userPrompt: `Given this filename: "${filename}"

And this document content excerpt (first 10,000 chars):
${textContent.slice(0, 10_000)}

Determine:
1. Which ISO standard this document likely belongs to (iso_9001, iso_14001, iso_45001, or unknown)
2. Which AI Sentinels sentinel should handle it: Qualy, Envi, Saffy, Doki, or Unknown
3. Suggested document category (policy, procedure, work_instruction, form, record, manual, plan, specification, external)
4. Your confidence level (0.0 to 1.0)

Return ONLY valid JSON:
{
  "isoStandard": "iso_9001",
  "sentinel": "Qualy",
  "category": "procedure",
  "confidence": 0.85
}`,
    tenantId,
    jsonMode: true,
    timeoutMs: 45_000,
  });

  return JSON.parse(result.text) as TriageResult;
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

export async function processBatch(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(BulkProcessSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { batchId, itemIds } = parsed.data;

  const { client } = await getDb();

  // Verify batch belongs to tenant (cross-tenant prevention)
  const batchRows = await client`
    SELECT id, status FROM bulk_upload_batches
    WHERE id = ${batchId}::uuid AND tenant_id = ${tenantId}
  `;
  if (batchRows.length === 0) {
    return json(404, { error: 'Batch not found' });
  }

  // Update batch status → 'processing'
  await client`
    UPDATE bulk_upload_batches SET status = 'processing'
    WHERE id = ${batchId}::uuid
  `;

  // Fetch items for this batch
  const items = await client`
    SELECT id, filename, file_type, s3_key, status
    FROM bulk_upload_items
    WHERE batch_id = ${batchId}::uuid AND tenant_id = ${tenantId}
      AND id = ANY(${itemIds}::uuid[])
  `;

  // Process each item in parallel
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const itemId = item.id as string;
      const filename = item.filename as string;
      const fileType = item.file_type as string;
      const s3Key = item.s3_key as string;

      try {
        // 1. Verify file exists in S3
        try {
          await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }));
        } catch {
          await client`
            UPDATE bulk_upload_items
            SET status = 'failed', error_message = 'File not found in S3'
            WHERE id = ${itemId}::uuid
          `;
          return { itemId, status: 'failed' as const, error: 'File not found in S3' };
        }

        // 2. Mark as uploaded
        await client`
          UPDATE bulk_upload_items SET status = 'uploaded'
          WHERE id = ${itemId}::uuid
        `;

        // 3. Mark as processing
        await client`
          UPDATE bulk_upload_items SET status = 'processing'
          WHERE id = ${itemId}::uuid
        `;

        // 4. Extract text from file
        const textContent = await extractText(s3Key, fileType);

        // 5. Omni triage — classify via Gemini
        let triage: TriageResult;
        try {
          triage = await triageDocument(filename, textContent, tenantId);
        } catch {
          // If triage fails, use defaults
          triage = {
            isoStandard: 'unknown',
            sentinel: 'Doki',
            category: 'external',
            confidence: 0,
          };
        }

        // 6. Create document in Aurora documents table
        // Wrap text as minimal TipTap JSON
        const bodyJsonb = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: textContent.slice(0, 50_000) }],
            },
          ],
        };

        // Map triage category to valid docType enum value
        const validDocTypes = [
          'policy', 'procedure', 'work_instruction', 'form', 'record',
          'manual', 'plan', 'specification', 'external',
        ];
        const docType = validDocTypes.includes(triage.category) ? triage.category : 'external';

        // Map isoStandard to standards array
        const standards: string[] = triage.isoStandard !== 'unknown'
          ? [triage.isoStandard]
          : [];

        const docRows = await client`
          INSERT INTO documents (tenant_id, title, doc_type, body_jsonb, status, version, standards, clause_refs, created_by)
          VALUES (
            ${tenantId}::uuid,
            ${filename},
            ${docType},
            ${JSON.stringify(bodyJsonb)}::jsonb,
            'draft',
            1,
            ${standards},
            ${[] as string[]},
            ${sub}::uuid
          )
          RETURNING id
        `;
        const documentId = docRows[0]!.id as string;

        // 7. Update bulk_upload_items with results
        await client`
          UPDATE bulk_upload_items SET
            status = 'completed',
            document_id = ${documentId}::uuid,
            sentinel = ${triage.sentinel},
            iso_standard = ${triage.isoStandard},
            processed_at = NOW()
          WHERE id = ${itemId}::uuid
        `;

        return {
          itemId,
          status: 'completed' as const,
          documentId,
          sentinel: triage.sentinel,
          isoStandard: triage.isoStandard,
          category: triage.category,
          confidence: triage.confidence,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await client`
          UPDATE bulk_upload_items SET
            status = 'failed',
            error_message = ${errorMessage.slice(0, 1000)},
            processed_at = NOW()
          WHERE id = ${itemId}::uuid
        `;
        return { itemId, status: 'failed' as const, error: errorMessage };
      }
    }),
  );

  // Count successes / failures
  let succeeded = 0;
  let failed = 0;
  const processedItems: Partial<BulkUploadItem>[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.status === 'completed') succeeded++;
      else failed++;
      processedItems.push(result.value);
    } else {
      failed++;
      processedItems.push({ status: 'failed', errorMessage: String(result.reason) });
    }
  }

  // Update batch with final counts
  const batchStatus = failed === itemIds.length ? 'failed' : 'completed';
  await client`
    UPDATE bulk_upload_batches SET
      status = ${batchStatus},
      processed = ${itemIds.length},
      succeeded = ${succeeded},
      failed = ${failed},
      completed_at = NOW()
    WHERE id = ${batchId}::uuid
  `;

  // Audit event (fire-and-forget)
  logAuditEvent({
    eventType: 'bulk.upload.processed',
    entityType: 'document',
    entityId: batchId,
    actorId: sub,
    tenantId,
    action: 'PROCESS',
    detail: { succeeded, failed, total: itemIds.length },
    severity: 'info',
  });

  return json(200, {
    batchId,
    status: batchStatus,
    succeeded,
    failed,
    items: processedItems,
  });
}
