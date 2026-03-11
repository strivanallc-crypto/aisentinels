import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { documents } from '@aisentinels/db/schema';
import { eq, and } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { UpdateDocumentSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { dispatchWebhook } from '../../lib/webhook-dispatcher.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function updateDocument(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Extract {id} from /api/v1/document-studio/documents/{id}
  const id = event.rawPath.split('/').at(-1) ?? '';
  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing document id' }),
    };
  }

  const parsed = parseBody(UpdateDocumentSchema, event.body);
  if ('statusCode' in parsed) return parsed;

  const { title, bodyJsonb, standards, clauseRefs } = parsed.data;

  // Build SET clause dynamically - only update provided fields
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (bodyJsonb !== undefined) updates.bodyJsonb = bodyJsonb;
  if (standards !== undefined) updates.standards = standards;
  if (clauseRefs !== undefined) updates.clauseRefs = clauseRefs;

  const { client } = await getDb();

  const [doc] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(documents)
      .set(updates)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .returning(),
  );

  if (!doc) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Document not found' }),
    };
  }

  logAuditEvent({
    eventType:  'document.updated',
    entityType: 'document',
    entityId:   doc.id,
    actorId:    sub,
    tenantId,
    action:     'UPDATE',
    detail:     { updatedFields: Object.keys(parsed.data).filter((k) => (parsed.data as Record<string, unknown>)[k] !== undefined) },
    severity:   'info',
  });

  dispatchWebhook({
    tenantId,
    eventType: 'document.updated',
    payload: { id: doc.id, title: doc.title },
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  };
}
