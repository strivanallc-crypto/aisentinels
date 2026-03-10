import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { tenants, subscriptions, users, orgContext, orgStandards } from '@aisentinels/db/schema';
import { eq } from 'drizzle-orm';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { sendEmail, FROM_NOTIFICATIONS } from '../../lib/mailer.ts';

const dynamo     = new DynamoDBClient({});
const cloudwatch = new CloudWatchClient({});
const AUDIT_TABLE  = process.env.AUDIT_EVENTS_TABLE_NAME ?? 'aisentinels-audit-events';
const WISE_API_KEY = process.env.WISE_API_KEY ?? '';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Plan tier definitions ────────────────────────────────────────────────────
// Allow ±$5 tolerance for currency rounding / FX conversion.
const PRICE_TOLERANCE = 5;

interface PlanTier {
  plan:           'starter' | 'professional' | 'enterprise';
  targetAmount:   number;
  aiCreditsLimit: number;
  maxUsers:       number;
}

const PLAN_TIERS: PlanTier[] = [
  { plan: 'starter',      targetAmount: 597,  aiCreditsLimit: 50,  maxUsers: 3  },
  { plan: 'professional', targetAmount: 1397, aiCreditsLimit: 200, maxUsers: 10 },
  { plan: 'enterprise',   targetAmount: 2497, aiCreditsLimit: 500, maxUsers: 25 },
];

function mapAmountToPlan(amount: number): PlanTier | null {
  for (const tier of PLAN_TIERS) {
    if (Math.abs(amount - tier.targetAmount) <= PRICE_TOLERANCE) {
      return tier;
    }
  }
  return null;
}

// ── Wise transfer API call ───────────────────────────────────────────────────
interface WiseTransfer {
  amount:   number;   // amount paid in source currency
  currency: string;   // source currency (e.g. 'USD')
}

async function fetchWiseTransfer(transferId: string): Promise<WiseTransfer | null> {
  if (!WISE_API_KEY) {
    console.error(JSON.stringify({ event: 'WiseApiFetchError', error: 'WISE_API_KEY not set' }));
    return null;
  }

  try {
    const res = await fetch(`https://api.wise.com/v1/transfers/${transferId}`, {
      headers: {
        'Authorization': `Bearer ${WISE_API_KEY}`,
        'Content-Type':  'application/json',
      },
    });

    if (!res.ok) {
      console.error(JSON.stringify({
        event:      'WiseApiFetchError',
        transferId,
        status:     res.status,
        statusText: res.statusText,
      }));
      return null;
    }

    const body = await res.json() as {
      sourceValue?: number;
      sourceCurrency?: string;
      amount?: number;
      currency?: string;
    };

    // Wise v1 transfers endpoint returns sourceValue + sourceCurrency
    const amount   = body.sourceValue    ?? body.amount   ?? 0;
    const currency = body.sourceCurrency ?? body.currency ?? 'USD';

    return { amount, currency };
  } catch (err) {
    console.error(JSON.stringify({ event: 'WiseApiFetchError', transferId, error: String(err) }));
    return null;
  }
}

// ── CloudWatch metric for unmatched payment amounts ──────────────────────────
async function emitUnmatchedPaymentMetric(amount: number, transferId: string): Promise<void> {
  try {
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'AiSentinels/Billing',
      MetricData: [{
        MetricName: 'UnmatchedPayment',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'TransferId', Value: transferId },
        ],
      }],
    }));
  } catch (err) {
    // Non-fatal — metric emission should never crash the webhook
    console.error(JSON.stringify({ event: 'CloudWatchMetricError', error: String(err) }));
  }
}

/**
 * Public endpoint — no JWT authorizer.
 * Called by Wise when a payment transfer changes state.
 *
 * Signature header: X-Wise-Signature
 * Algorithm: HMAC-SHA256, hex-encoded
 * Reference: https://docs.wise.com/api-docs/features/webhooks-notifications
 *
 * NOTE: Verify the exact digest encoding (hex vs base64) against Wise docs
 * before deploying to production.
 */
export async function wiseWebhook(event: APIGatewayProxyEventV2): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  // ── Signature validation ────────────────────────────────────────────────────
  const secret   = process.env.WISE_WEBHOOK_SECRET ?? '';
  const rawBody  = event.body ?? '';
  // Wise X-Wise-Signature header is hex-encoded HMAC-SHA256
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const received = (event.headers?.['x-wise-signature'] ?? event.headers?.['X-Wise-Signature'] ?? '');

  // Constant-time comparison — prevents timing side-channel attacks.
  // timingSafeEqual requires identical buffer lengths; mismatched length = invalid sig.
  let signatureValid = false;
  try {
    const expBuf = Buffer.from(expected, 'hex');
    const recBuf = Buffer.from(received, 'hex');
    if (expBuf.length > 0 && expBuf.length === recBuf.length) {
      signatureValid = timingSafeEqual(expBuf, recBuf);
    }
  } catch { /* signatureValid stays false */ }

  if (!secret || !signatureValid) {
    console.warn(JSON.stringify({ event: 'WiseWebhookBadSignature' }));
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let payload: {
    event_type?: string;
    data?: {
      resource?: { id?: string | number; type?: string };
      current_state?: string;
      resource_id?: string | number;
    };
  } = {};
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const eventType    = payload.event_type ?? '';
  const currentState = payload.data?.current_state ?? '';
  const transferId   = String(payload.data?.resource?.id ?? payload.data?.resource_id ?? '');

  // Only handle transfer state changes
  if (eventType !== 'transfers#state-change') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true }),
    };
  }

  // ── Determine new subscription status ──────────────────────────────────────
  type SubStatus = 'active' | 'past_due';
  const ACTION_MAP: Record<string, SubStatus> = {
    outgoing_payment_sent: 'active',
    bounced_back:          'past_due',
    funds_refunded:        'past_due',
  };

  const newStatus = ACTION_MAP[currentState];
  if (!newStatus) {
    // Intermediate or unrecognised state — ack and ignore
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true }),
    };
  }

  // ── Tenant lookup (intentional RLS bypass for webhook ingestion) ─────────────
  // This SELECT runs on the raw DB client BEFORE any tenant context is set.
  // We identify the tenant from the Wise transferId, then use withTenantContext
  // for the subsequent UPDATE. Do NOT use withTenantContext here — it requires
  // app.tenant_id to already be set.
  const { db, client } = await getDb();
  const [existing] = await db
    .select({ tenantId: subscriptions.tenantId, id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.wiseTransferId, transferId))
    .limit(1);

  if (!existing) {
    // Unknown transfer — acknowledge silently (don't leak information)
    console.warn(JSON.stringify({ event: 'WiseWebhookUnknownTransfer', transferId }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true }),
    };
  }

  const { tenantId } = existing;
  const now = new Date();

  // ── Update subscription ─────────────────────────────────────────────────────
  type SubscriptionUpdate = Partial<typeof subscriptions.$inferInsert>;

  const updateValues: SubscriptionUpdate = {
    status:    newStatus,
    updatedAt: now,
  };

  if (newStatus === 'active') {
    // ── Fetch transfer amount from Wise API and map to plan tier ──────────────
    // On outgoing_payment_sent: fetch the transfer details to detect which
    // plan was purchased based on the payment amount.
    //
    // Failure is non-fatal: billing period still advances, plan stays unchanged.
    // Admin can correct via POST /api/v1/admin/billing/activate.
    const transfer = await fetchWiseTransfer(transferId);

    if (transfer) {
      const tier = mapAmountToPlan(transfer.amount);

      if (!tier) {
        // Amount doesn't match any known tier — log + alert, do NOT activate
        const warnMsg = {
          event:      'WiseWebhookUnmatchedAmount',
          tenantId,
          transferId,
          amount:     transfer.amount,
          currency:   transfer.currency,
          knownTiers: PLAN_TIERS.map(t => t.targetAmount),
        };
        console.warn(JSON.stringify(warnMsg));

        // Emit CloudWatch metric so ops team is alerted
        await emitUnmatchedPaymentMetric(transfer.amount, transferId);

        // Record in DynamoDB audit trail
        try {
          await dynamo.send(new PutItemCommand({
            TableName: AUDIT_TABLE,
            Item: {
              pk:         { S: `TENANT#${tenantId}` },
              sk:         { S: `BILLING_WARN#${now.getTime()}` },
              eventType:  { S: 'wise.webhook.unmatched_amount' },
              transferId: { S: transferId },
              amount:     { N: String(transfer.amount) },
              currency:   { S: transfer.currency },
              timestamp:  { S: now.toISOString() },
            },
          }));
        } catch (dynErr) {
          console.error(JSON.stringify({ event: 'WiseWebhookDynamoError', error: String(dynErr) }));
        }

        // Return 200 — Wise must not retry; admin resolves manually
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ received: true, warning: 'unmatched_amount' }),
        };
      }

      // Amount matched a tier — set plan + credit limit
      updateValues.plan           = tier.plan;
      updateValues.aiCreditsLimit = tier.aiCreditsLimit;

      console.log(JSON.stringify({
        event:          'WiseWebhookPlanMapped',
        tenantId,
        transferId,
        amount:         transfer.amount,
        currency:       transfer.currency,
        plan:           tier.plan,
        aiCreditsLimit: tier.aiCreditsLimit,
        maxUsers:       tier.maxUsers,
      }));
    } else {
      // Wise API call failed — continue without plan re-mapping
      console.warn(JSON.stringify({
        event:      'WiseWebhookPlanMappingSkipped',
        tenantId,
        transferId,
        reason:     'Wise API fetch failed — plan unchanged, use /admin/billing/activate to correct',
      }));
    }

    // Advance the billing period by one month
    updateValues.currentPeriodStart = now;
    updateValues.currentPeriodEnd   = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );
    updateValues.wiseTransferId = transferId;
    // Reset AI credit counter for the new billing period
    updateValues.aiCreditsUsed = 0;
  }

  await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(subscriptions)
      .set(updateValues)
      .where(eq(subscriptions.tenantId, tenantId)),
  );

  // ── Tenant provisioning on activation ─────────────────────────────────────
  // On first payment: activate tenant, seed org_context, activate ISO standards,
  // and send account-activated email. Non-fatal — subscription is already active.
  if (newStatus === 'active') {
    try {
      // Activate tenant
      await withTenantContext(client, tenantId, async (txDb) =>
        txDb.update(tenants).set({ status: 'active', updatedAt: now }).where(eq(tenants.id, tenantId)),
      );

      // Fetch tenant name for org_context seeding
      const [tenantRow] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const companyName = tenantRow?.name ?? 'Unknown';

      // Seed org_context (upsert — idempotent for re-processed webhooks)
      await withTenantContext(client, tenantId, async (txDb) =>
        txDb.insert(orgContext).values({
          tenantId,
          companyName,
        }).onConflictDoNothing(),
      );

      // Activate ISO standards based on plan tier
      const plan = updateValues.plan ?? 'starter';
      const PLAN_STANDARDS: Record<string, string[]> = {
        starter:      ['ISO 9001'],
        professional: ['ISO 9001', 'ISO 14001'],
        enterprise:   ['ISO 9001', 'ISO 14001', 'ISO 45001'],
      };
      const standardCodes = PLAN_STANDARDS[plan] ?? ['ISO 9001'];

      await withTenantContext(client, tenantId, async (txDb) => {
        for (const code of standardCodes) {
          await txDb.insert(orgStandards).values({
            tenantId,
            standardCode: code,
          }).onConflictDoNothing();
        }
      });

      // Send account-activated email (fire-and-forget)
      const [ownerRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.tenantId, tenantId))
        .limit(1);

      if (ownerRow?.email) {
        sendEmail({
          to: ownerRow.email,
          from: FROM_NOTIFICATIONS,
          subject: 'Your AI Sentinels account is active!',
          html: `<p>Your payment has been received and your account is now active.</p><p>Log in at <a href="https://aisentinels.io/login">aisentinels.io</a> to get started.</p>`,
          text: `Your payment has been received and your account is now active. Log in at https://aisentinels.io/login to get started.`,
        });
      }

      console.log(JSON.stringify({
        event: 'WiseWebhookTenantProvisioned',
        tenantId,
        plan,
        standards: standardCodes,
      }));
    } catch (provErr) {
      // Non-fatal — subscription is already active, provisioning can be retried manually
      console.error(JSON.stringify({
        event: 'WiseWebhookProvisioningError',
        tenantId,
        error: String(provErr),
      }));
    }
  }

  // ── Audit log to DynamoDB ───────────────────────────────────────────────────
  try {
    await dynamo.send(new PutItemCommand({
      TableName: AUDIT_TABLE,
      Item: {
        pk:           { S: `TENANT#${tenantId}` },
        sk:           { S: `BILLING#${now.getTime()}` },
        eventType:    { S: eventType },
        wiseState:    { S: currentState },
        newStatus:    { S: newStatus },
        ...(updateValues.plan ? { plan: { S: updateValues.plan } } : {}),
        transferId:   { S: transferId },
        timestamp:    { S: now.toISOString() },
      },
    }));
  } catch (dynErr) {
    // Non-fatal — log and continue (subscription was already updated)
    console.error(JSON.stringify({ event: 'WiseWebhookDynamoError', error: String(dynErr) }));
  }

  console.log(JSON.stringify({ event: 'WiseWebhookProcessed', tenantId, currentState, newStatus, plan: updateValues.plan ?? 'unchanged' }));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true, newStatus }),
  };
}
