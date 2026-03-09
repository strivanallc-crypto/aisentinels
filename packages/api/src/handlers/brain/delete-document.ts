import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { orgDocuments } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const BUCKET = process.env.WORKING_FILES_BUCKET ?? `aisentinels-working-files-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function deleteBrainDocument(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const path = event.rawPath;

  // Extract document ID from path: /api/v1/brain/documents/{id}
  const segments = path.split('/');
  const docId = segments[segments.length - 1] ?? '';

  if (!docId || docId === 'documents') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing document ID' }),
    };
  }

  const { client } = await getDb();

  const result = await withTenantContext(client, tenantId, async (txDb) => {
    // Get the document to find S3 key (and verify tenant ownership)
    const [doc] = await txDb
      .select()
      .from(orgDocuments)
      .where(and(eq(orgDocuments.tenantId, tenantId), eq(orgDocuments.id, docId)))
      .limit(1);

    if (!doc) return { error: 'Document not found' };

    // Delete from DB (cascades to org_knowledge_chunks via FK)
    await txDb
      .delete(orgDocuments)
      .where(and(eq(orgDocuments.tenantId, tenantId), eq(orgDocuments.id, docId)));

    // Remove S3 file (best-effort — DB already cleaned up)
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.s3Key }));
    } catch (err) {
      console.warn(`Failed to delete S3 object ${doc.s3Key}:`, err);
    }

    return { deleted: true, chunksRemoved: doc.chunkCount };
  });

  if (result && 'error' in result) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: (result as { error: string }).error }),
    };
  }

  logAuditEvent({
    eventType:  'brain.document.deleted',
    entityType: 'brain',
    entityId:   docId,
    actorId:    sub,
    tenantId,
    action:     'DELETE',
    detail:     { chunksRemoved: (result as { chunksRemoved?: number }).chunksRemoved },
    severity:   'warning',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
