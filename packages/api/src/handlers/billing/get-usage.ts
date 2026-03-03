import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { subscriptions } from '@aisentinels/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function getBillingUsage(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const { client } = await getDb();

  const [row] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1),
  );

  if (!row) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No subscription found for this tenant' }),
    };
  }

  const creditsRemaining = Math.max(0, row.aiCreditsLimit - row.aiCreditsUsed);
  const usagePercent     = row.aiCreditsLimit > 0
    ? Math.round((row.aiCreditsUsed / row.aiCreditsLimit) * 100)
    : 0;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aiCreditsUsed:    row.aiCreditsUsed,
      aiCreditsLimit:   row.aiCreditsLimit,
      creditsRemaining,
      usagePercent,
      periodStart: row.currentPeriodStart.toISOString(),
      periodEnd:   row.currentPeriodEnd.toISOString(),
      plan:        row.plan,
      status:      row.status,
    }),
  };
}
