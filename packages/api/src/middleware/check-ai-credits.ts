/**
 * AI credit metering middleware.
 *
 * Checks the tenant's remaining AI credits before allowing the request.
 * Uses an atomic UPDATE … WHERE ai_credits_used < limit to prevent race
 * conditions — if two requests arrive simultaneously, only one can win
 * the last credit.
 *
 * Returns a 429 JSON response when credits are exhausted.
 * On success, increments ai_credits_used by 1 and delegates to the
 * inner handler.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { subscriptions } from '@aisentinels/db/schema';
import { eq, and, lt, sql, desc } from 'drizzle-orm';
import { extractClaims } from './auth-context.ts';
import { withTenantContext } from './tenant-context.ts';

// Locked credit limits per plan (matches pricing spec)
const PLAN_CREDIT_LIMITS: Record<string, number> = {
  starter:      50,
  professional: 200,
  enterprise:   500,
};

type AiHandler = (event: APIGatewayProxyEventV2WithJWTAuthorizer) => Promise<APIGatewayProxyResultV2>;

// Module-scope singleton — reused across warm Lambda invocations
let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

/**
 * Wraps an AI handler with credit deduction logic.
 *
 * 1. Extracts tenantId from JWT
 * 2. Atomically increments ai_credits_used WHERE under limit
 * 3. If 0 rows updated → credits exhausted → 429
 * 4. Otherwise delegates to the inner handler
 */
export function withCreditCheck(handler: AiHandler): AiHandler {
  return async (event) => {
    const { tenantId } = extractClaims(event);
    const { client } = await getDb();

    // Atomic increment: only succeeds if ai_credits_used < plan limit.
    // Single UPDATE avoids TOCTOU race between SELECT and UPDATE.
    const updated = await withTenantContext(client, tenantId, async (txDb) => {
      // Fetch current plan to determine limit
      const [sub] = await txDb
        .select({ plan: subscriptions.plan, used: subscriptions.aiCreditsUsed, limit: subscriptions.aiCreditsLimit })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (!sub) return null;

      const limit = PLAN_CREDIT_LIMITS[sub.plan] ?? sub.limit;

      // Atomic conditional increment
      const rows = await txDb
        .update(subscriptions)
        .set({
          aiCreditsUsed: sql`${subscriptions.aiCreditsUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            lt(subscriptions.aiCreditsUsed, limit),
          ),
        )
        .returning({ used: subscriptions.aiCreditsUsed });

      if (rows.length === 0) {
        return { exhausted: true, used: sub.used, limit };
      }

      return { exhausted: false, used: rows[0]!.used, limit };
    });

    // No subscription found
    if (!updated) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No active subscription found' }),
      };
    }

    // Credits exhausted
    if (updated.exhausted) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'AI_CREDITS_EXHAUSTED',
          used: updated.used,
          limit: updated.limit,
          upgradeUrl: '/billing',
        }),
      };
    }

    // Credits available — proceed to the actual AI handler
    return handler(event);
  };
}
