import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { subscriptions } from '@aisentinels/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { UpgradePlanSchema, parseBody } from '../../lib/validate.ts';

// AI credit limits per plan
const PLAN_LIMITS: Record<string, number> = {
  starter:      100,
  professional: 1000,
  enterprise:   10000,
};

// Upgrade-only order (cannot downgrade)
const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

/**
 * POST /api/v1/billing/upgrade
 *
 * Body: { plan: 'professional' | 'enterprise' }
 *
 * Directly updates the subscription plan and aiCreditsLimit in the DB.
 * TODO E11: Replace with Wise invoice creation (POST to Wise Business API)
 * to generate a payment request before activating the new plan.
 */
export async function upgradePlan(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  const parsed = parseBody(UpgradePlanSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { plan: newPlan } = parsed.data;

  const { client } = await getDb();

  // Fetch current plan
  const [current] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select({ id: subscriptions.id, plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1),
  );

  if (!current) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No subscription found for this tenant' }),
    };
  }

  if (PLAN_ORDER.indexOf(newPlan) <= PLAN_ORDER.indexOf(current.plan)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `Cannot downgrade or stay on the same plan. Current plan: ${current.plan}`,
      }),
    };
  }

  const [updated] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(subscriptions)
      .set({
        plan:           newPlan as typeof subscriptions.$inferInsert['plan'],
        aiCreditsLimit: PLAN_LIMITS[newPlan]!,
        updatedAt:      new Date(),
      })
      .where(eq(subscriptions.tenantId, tenantId))
      .returning(),
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  };
}
