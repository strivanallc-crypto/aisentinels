import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { capaRecords } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { UpdateCapaStatusSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function updateCapaStatus(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Path: /api/v1/capa/{id}/status  — id is second-to-last segment
  const segments = event.rawPath.split('/');
  const id = segments.at(-2) ?? '';

  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing CAPA id' }),
    };
  }

  const parsed = parseBody(UpdateCapaStatusSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { status } = parsed.data;

  const newStatus = status as typeof capaRecords.$inferInsert['status'];
  const now = new Date();

  const { client } = await getDb();

  const [updated] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(capaRecords)
      .set({
        status:     newStatus,
        closedDate: newStatus === 'closed' ? now : null,
        updatedAt:  now,
      })
      .where(and(eq(capaRecords.id, id), eq(capaRecords.tenantId, tenantId)))
      .returning(),
  );

  if (!updated) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'CAPA record not found' }),
    };
  }

  logAuditEvent({
    eventType:  'capa.status.changed',
    entityType: 'capa',
    entityId:   id,
    actorId:    sub,
    tenantId,
    action:     'UPDATE',
    detail:     { newStatus: status },
    severity:   status === 'closed' ? 'info' : 'warning',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  };
}
