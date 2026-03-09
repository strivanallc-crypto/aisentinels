import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { orgDocuments, orgKnowledgeChunks } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { ProcessDocumentSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const BUCKET = process.env.WORKING_FILES_BUCKET ?? `aisentinels-working-files-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Text extraction ─────────────────────────────────────────────────────────
async function extractText(s3Key: string, fileType: string | null): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  const response = await s3.send(command);
  const body = await response.Body?.transformToByteArray();
  if (!body) throw new Error('Empty S3 object');

  if (fileType === 'txt') {
    return new TextDecoder().decode(body);
  }

  if (fileType === 'pdf') {
    // pdf-parse is CJS — dynamic import needs ESM compat shim
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default
      ?? (pdfModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
    const result = await pdfParse(Buffer.from(body));
    return result.text;
  }

  if (fileType === 'docx') {
    // mammoth extracts text from DOCX
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(body) });
    return result.value;
  }

  // Fallback: treat as plain text
  return new TextDecoder().decode(body);
}

// ── Chunking ────────────────────────────────────────────────────────────────
// ~450 tokens per chunk, 50-token overlap. 1 token ~ 4 chars.
const CHUNK_SIZE_CHARS = 1800;  // ~450 tokens
const OVERLAP_CHARS   = 200;   // ~50 tokens

function chunkText(text: string): { content: string; tokenCount: number }[] {
  const chunks: { content: string; tokenCount: number }[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > CHUNK_SIZE_CHARS && current.length > 0) {
      chunks.push({
        content: current.trim(),
        tokenCount: Math.ceil(current.trim().length / 4),
      });
      // Overlap: keep the last portion
      const overlap = current.slice(-OVERLAP_CHARS);
      current = overlap + ' ' + sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }

  if (current.trim()) {
    chunks.push({
      content: current.trim(),
      tokenCount: Math.ceil(current.trim().length / 4),
    });
  }

  return chunks;
}

// ── Handler ─────────────────────────────────────────────────────────────────
export async function processDocument(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(ProcessDocumentSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { orgDocumentId } = parsed.data;

  const { client } = await getDb();

  const result = await withTenantContext(client, tenantId, async (txDb) => {
    // Get the document record
    const [doc] = await txDb
      .select()
      .from(orgDocuments)
      .where(and(eq(orgDocuments.tenantId, tenantId), eq(orgDocuments.id, orgDocumentId)))
      .limit(1);

    if (!doc) return { error: 'Document not found', statusCode: 404 };

    // Update status to chunking
    await txDb
      .update(orgDocuments)
      .set({ processingStatus: 'chunking' })
      .where(eq(orgDocuments.id, orgDocumentId));

    try {
      // Extract text
      const text = await extractText(doc.s3Key, doc.fileType);

      // Chunk the text
      const chunks = chunkText(text);

      // Batch insert chunks
      if (chunks.length > 0) {
        await txDb.insert(orgKnowledgeChunks).values(
          chunks.map((chunk, index) => ({
            tenantId,
            orgDocumentId,
            chunkIndex: index,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
          })),
        );
      }

      // Update document as ready
      await txDb
        .update(orgDocuments)
        .set({
          processingStatus: 'ready',
          chunkCount: chunks.length,
          processedAt: new Date(),
        })
        .where(eq(orgDocuments.id, orgDocumentId));

      return { chunksCreated: chunks.length, status: 'ready' as const };
    } catch (err) {
      // Mark as failed
      await txDb
        .update(orgDocuments)
        .set({ processingStatus: 'failed' })
        .where(eq(orgDocuments.id, orgDocumentId));
      throw err;
    }
  });

  if (result && 'error' in result) {
    return {
      statusCode: (result as { statusCode: number }).statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: (result as { error: string }).error }),
    };
  }

  logAuditEvent({
    eventType:  'brain.document.processed',
    entityType: 'brain',
    entityId:   orgDocumentId,
    actorId:    sub,
    tenantId,
    action:     'PROCESS',
    detail:     { chunksCreated: (result as { chunksCreated?: number }).chunksCreated },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
