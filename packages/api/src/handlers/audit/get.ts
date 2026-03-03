import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { auditSessions, auditFindings } from '@aisentinels/db/schema';
import { eq, and } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function getAudit(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  // Extract {id} — last path segment of /api/v1/audits/{id}
  const id = event.rawPath.split('/').at(-1) ?? '';
  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing audit id' }),
    };
  }

  const { client } = await getDb();

  const [session, findings] = await withTenantContext(client, tenantId, async (txDb) =>
    Promise.all([
      txDb
        .select()
        .from(auditSessions)
        .where(and(eq(auditSessions.id, id), eq(auditSessions.tenantId, tenantId)))
        .then((rows) => rows[0]),
      txDb
        .select()
        .from(auditFindings)
        .where(and(eq(auditFindings.sessionId, id), eq(auditFindings.tenantId, tenantId))),
    ]),
  );

  if (!session) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Audit session not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, findings }),
  };
}
