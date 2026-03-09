import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { capaRecords } from '@aisentinels/db/schema';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { CreateCapaSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function createCapa(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(CreateCapaSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const {
    sourceType, standard, severity, problemDescription,
    dueDate, clauseRef, rootCauseMethod, rootCauseAnalysis,
  } = parsed.data;

  const { client } = await getDb();

  const [record] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .insert(capaRecords)
      .values({
        tenantId,
        sourceType:         sourceType as typeof capaRecords.$inferInsert['sourceType'],
        standard:           standard   as typeof capaRecords.$inferInsert['standard'],
        clauseRef,
        severity:           severity   as typeof capaRecords.$inferInsert['severity'],
        problemDescription,
        rootCauseMethod:    rootCauseMethod as typeof capaRecords.$inferInsert['rootCauseMethod'],
        rootCauseAnalysis,
        actionsJsonb:       [],
        ownerId:            sub,
        dueDate:            new Date(dueDate),
        status:             'open',
      })
      .returning(),
  );

  logAuditEvent({
    eventType:  'capa.created',
    entityType: 'capa',
    entityId:   record!.id,
    actorId:    sub,
    tenantId,
    action:     'CREATE',
    detail:     { sourceType, severity: severity as string, problemDescription },
    clauseRef,
    standard:   standard as string,
    severity:   'info',
  });

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  };
}
