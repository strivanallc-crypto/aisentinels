import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { auditFindings } from '@aisentinels/db/schema';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { AddFindingSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function addFinding(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Path: /api/v1/audits/{id}/findings — extract {id} (second-to-last segment)
  const segments = event.rawPath.split('/');
  const sessionId = segments.at(-2) ?? '';
  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing session id' }),
    };
  }

  const parsed = parseBody(AddFindingSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { clauseRef, standard, severity, description } = parsed.data;

  const { client } = await getDb();

  const [finding] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .insert(auditFindings)
      .values({
        tenantId,
        sessionId,
        clauseRef,
        standard:    standard    as typeof auditFindings.$inferInsert['standard'],
        severity:    severity    as typeof auditFindings.$inferInsert['severity'],
        description,
        evidenceIds: [],
        status:      'open',
      })
      .returning(),
  );

  logAuditEvent({
    eventType:  'audit.finding.raised',
    entityType: 'audit',
    entityId:   finding!.id,
    actorId:    sub,
    tenantId,
    action:     'FINDING',
    detail:     { sessionId, clauseRef, standard, severity: severity as string, description },
    clauseRef,
    standard:   standard as string,
    severity:   'info',
  });

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finding),
  };
}
