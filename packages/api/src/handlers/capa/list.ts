import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { capaRecords } from '@aisentinels/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function listCapas(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const { client } = await getDb();

  const rows = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select()
      .from(capaRecords)
      .where(eq(capaRecords.tenantId, tenantId))
      .orderBy(desc(capaRecords.updatedAt)),
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  };
}
