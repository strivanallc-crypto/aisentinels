import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { auditSessions } from '@aisentinels/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function listAudits(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const { client } = await getDb();

  const rows = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select()
      .from(auditSessions)
      .where(eq(auditSessions.tenantId, tenantId))
      .orderBy(desc(auditSessions.auditDate)),
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  };
}
