import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { createDb } from '@aisentinels/db';
import { capaRecords } from '@aisentinels/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { AddCapaActionSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function addCapaAction(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Path: /api/v1/capa/{id}/actions — id is second-to-last segment
  const segments = event.rawPath.split('/');
  const capaId = segments.at(-2) ?? '';

  if (!capaId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing CAPA id' }),
    };
  }

  const parsed = parseBody(AddCapaActionSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { description, actionType, owner, dueDate } = parsed.data;

  const action = {
    id: randomUUID(),
    description,
    actionType,
    ownerId: owner ?? sub,
    dueDate: dueDate ?? null,
    completedAt: undefined,
    status: 'open' as const,
  };

  const { client } = await getDb();

  const [updated] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(capaRecords)
      .set({
        actionsJsonb: sql`coalesce(${capaRecords.actionsJsonb}, '[]'::jsonb) || ${JSON.stringify([action])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(capaRecords.id, capaId), eq(capaRecords.tenantId, tenantId)))
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
    eventType:  'capa.action.added',
    entityType: 'capa',
    entityId:   capaId,
    actorId:    sub,
    tenantId,
    action:     'UPDATE',
    detail:     { actionId: action.id, actionType, description },
    severity:   'info',
  });

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  };
}
