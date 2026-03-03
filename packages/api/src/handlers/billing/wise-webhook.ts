import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { subscriptions } from '@aisentinels/db/schema';
import { eq } from 'drizzle-orm';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { withTenantContext } from '../../middleware/tenant-context.ts';

const dynamo = new DynamoDBClient({});
const AUDIT_TABLE = process.env.AUDIT_EVENTS_TABLE_NAME ?? 'aisentinels-audit-events';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
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
    // Advance the billing period by one month from current period end
    updateValues.currentPeriodStart = now;
    updateValues.currentPeriodEnd   = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );
    updateValues.wiseTransferId = transferId;
  }

  await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(subscriptions)
      .set(updateValues)
      .where(eq(subscriptions.tenantId, tenantId)),
  );

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
        transferId:   { S: transferId },
        timestamp:    { S: now.toISOString() },
      },
    }));
  } catch (dynErr) {
    // Non-fatal — log and continue (subscription was already updated)
    console.error(JSON.stringify({ event: 'WiseWebhookDynamoError', error: String(dynErr) }));
  }

  console.log(JSON.stringify({ event: 'WiseWebhookProcessed', tenantId, currentState, newStatus }));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true, newStatus }),
  };
}
