import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { orgStandards } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function deactivateStandard(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const path = event.rawPath;

  // Extract standard code from path: /api/v1/settings/standards/ISO%209001
  const segments = path.split('/');
  const rawCode = segments[segments.length - 1] ?? '';
  const standardCode = decodeURIComponent(rawCode);

  if (!['ISO 9001', 'ISO 14001', 'ISO 45001'].includes(standardCode)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Invalid standard code: ${standardCode}` }),
    };
  }

  const { client } = await getDb();

  await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .delete(orgStandards)
      .where(and(eq(orgStandards.tenantId, tenantId), eq(orgStandards.standardCode, standardCode))),
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deactivated: true }),
  };
}
