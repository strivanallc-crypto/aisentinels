import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { capaRecords } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function getCapa(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  // Extract {id} — last path segment of /api/v1/capa/{id}
  const id = event.rawPath.split('/').at(-1) ?? '';
  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing CAPA id' }),
    };
  }

  const { client } = await getDb();

  const [record] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select()
      .from(capaRecords)
      .where(and(eq(capaRecords.id, id), eq(capaRecords.tenantId, tenantId))),
  );

  if (!record) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'CAPA record not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  };
}
