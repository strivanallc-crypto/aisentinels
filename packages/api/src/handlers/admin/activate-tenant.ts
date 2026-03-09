/**
 * POST /api/v1/admin/billing/activate
 *
 * Manual admin endpoint to activate a tenant's subscription after verifying
 * a Wise payment out-of-band. This is the bridge that lets the team collect
 * revenue before full webhook automation is complete.
 *
 * Auth: JWT required + role === 'admin' (enforced in handler).
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { createDb } from '@aisentinels/db';
import { subscriptions } from '@aisentinels/db/schema';
import { eq } from 'drizzle-orm';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { extractClaims } from '../../middleware/auth-context.ts';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const dynamo = new DynamoDBClient({});
const AUDIT_TABLE = process.env.AUDIT_EVENTS_TABLE_NAME ?? 'aisentinels-audit-events';

// Locked plan limits (pricing spec)
const PLAN_CONFIG: Record<string, { aiCreditsLimit: number; maxUsers: number }> = {
  starter:      { aiCreditsLimit: 50,  maxUsers: 3 },
  professional: { aiCreditsLimit: 200, maxUsers: 10 },
  enterprise:   { aiCreditsLimit: 500, maxUsers: 25 },
};

const ActivateTenantSchema = z.object({
  tenant_id: z.string().uuid(),
  plan: z.enum(['starter', 'professional', 'enterprise']),
  billing_cycle: z.enum(['monthly', 'annual']),
  payment_reference: z.string().min(1).max(500),
});

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function activateTenant(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  // ── Admin role check ────────────────────────────────────────────────────
  const claims = extractClaims(event);
  if (claims.role !== 'admin') {
    return json(403, { error: 'Forbidden — admin role required' });
  }

  // ── Parse + validate body ───────────────────────────────────────────────
  const parsed = parseBody(ActivateTenantSchema, event.body);
  if ('statusCode' in parsed) return parsed;

  const { tenant_id, plan, billing_cycle, payment_reference } = parsed.data;
  const config = PLAN_CONFIG[plan]!;
  const now = new Date();

  const periodEnd = billing_cycle === 'annual'
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // ── Upsert subscription ─────────────────────────────────────────────────
  const { client } = await getDb();

  const [updated] = await withTenantContext(client, tenant_id, async (txDb) => {
    // Check if subscription exists
    const [existing] = await txDb
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenant_id))
      .limit(1);

    if (existing) {
      // UPDATE existing subscription
      return txDb
        .update(subscriptions)
        .set({
          plan:               plan as typeof subscriptions.$inferInsert['plan'],
          status:             'active' as const,
          aiCreditsUsed:      0,
          aiCreditsLimit:     config.aiCreditsLimit,
          currentPeriodStart: now,
          currentPeriodEnd:   periodEnd,
          wiseTransferId:     payment_reference,
          updatedAt:          now,
        })
        .where(eq(subscriptions.tenantId, tenant_id))
        .returning();
    }

    // INSERT new subscription (first activation)
    return txDb
      .insert(subscriptions)
      .values({
        tenantId:           tenant_id,
        plan:               plan as typeof subscriptions.$inferInsert['plan'],
        status:             'active',
        aiCreditsUsed:      0,
        aiCreditsLimit:     config.aiCreditsLimit,
        currentPeriodStart: now,
        currentPeriodEnd:   periodEnd,
        wiseTransferId:     payment_reference,
      })
      .returning();
  });

  // ── Audit log to DynamoDB ───────────────────────────────────────────────
  try {
    await dynamo.send(new PutItemCommand({
      TableName: AUDIT_TABLE,
      Item: {
        pk:               { S: `TENANT#${tenant_id}` },
        sk:               { S: `BILLING#${now.getTime()}` },
        eventType:        { S: 'admin.billing.activate' },
        plan:             { S: plan },
        billingCycle:     { S: billing_cycle },
        paymentReference: { S: payment_reference },
        activatedBy:      { S: claims.sub },
        activatedByEmail: { S: claims.email },
        timestamp:        { S: now.toISOString() },
      },
    }));
  } catch (dynErr) {
    // Non-fatal — log and continue (subscription was already activated)
    console.error(JSON.stringify({ event: 'AdminActivateDynamoError', error: String(dynErr) }));
  }

  logAuditEvent({
    eventType:  'admin.billing.activate',
    entityType: 'billing',
    entityId:   tenant_id,
    actorId:    claims.sub,
    actorEmail: claims.email,
    tenantId:   tenant_id,
    action:     'ACTIVATE',
    detail:     { plan, billing_cycle, payment_reference },
    severity:   'critical',
  });

  console.log(JSON.stringify({
    event: 'AdminBillingActivate',
    tenantId: tenant_id,
    plan,
    billingCycle: billing_cycle,
    activatedBy: claims.sub,
  }));

  return json(200, {
    success: true,
    tenant_id,
    plan,
    billing_cycle,
    ai_credits_limit: config.aiCreditsLimit,
    max_users: config.maxUsers,
    period_end: periodEnd.toISOString(),
  });
}
