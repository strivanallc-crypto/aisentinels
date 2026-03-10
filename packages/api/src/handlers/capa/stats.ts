/**
 * GET /api/v1/capa/stats/dashboard
 *
 * Returns CAPA count breakdown by status for the current tenant.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { capaRecords } from '@aisentinels/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function capaStatsDashboard(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const { client } = await getDb();

  const rows = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select({
        status: capaRecords.status,
        count: sql<number>`count(*)::int`,
      })
      .from(capaRecords)
      .where(eq(capaRecords.tenantId, tenantId))
      .groupBy(capaRecords.status),
  );

  const stats = { total: 0, open: 0, inProgress: 0, closed: 0 };

  for (const row of rows) {
    stats.total += row.count;
    if (row.status === 'open') stats.open = row.count;
    else if (row.status === 'in_progress') stats.inProgress = row.count;
    else if (row.status === 'closed') stats.closed = row.count;
  }

  logAuditEvent({
    eventType:  'capa.stats.viewed',
    entityType: 'capa',
    entityId:   'dashboard',
    actorId:    sub,
    tenantId,
    action:     'REVIEW',
    detail:     { total: stats.total },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stats),
  };
}
