/**
 * Webhook Dispatcher — fire-and-forget webhook delivery to tenant endpoints.
 *
 * CRITICAL RULES (mirrors audit-logger.ts pattern):
 *   1. dispatchWebhook() is VOID — fire-and-forget. NEVER awaited in hot path.
 *   2. NEVER throws — all errors caught internally and logged to CloudWatch.
 *   3. NEVER blocks the caller's response. If delivery fails, the mutation
 *      still succeeds; only the webhook delivery fails silently.
 *   4. Uses HMAC-SHA256 signing for payload verification.
 *
 * Usage (fire-and-forget — no await):
 *   dispatchWebhook({
 *     tenantId: '...',
 *     eventType: 'document.created',
 *     payload: { id: '...', type: 'document', ... },
 *   });
 */
import { createDb } from '@aisentinels/db';
import { webhookEndpoints, webhookDeliveries } from '@aisentinels/db/schema';
import { eq, and, arrayContains } from 'drizzle-orm';
import { withTenantContext } from '../middleware/tenant-context.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WebhookEvent {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

// ── DB singleton ──────────────────────────────────────────────────────────────
let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── HMAC-SHA256 signing ───────────────────────────────────────────────────────
async function signPayload(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Delivery function ─────────────────────────────────────────────────────────
async function deliverToEndpoint(
  tenantId: string,
  endpoint: { id: string; url: string; secret: string },
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { client } = await getDb();
  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = await signPayload(endpoint.secret, body);
  const startMs = Date.now();
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let status: 'success' | 'failed' = 'failed';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const resp = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': eventType,
        'X-Webhook-Timestamp': new Date().toISOString(),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = resp.status;
    responseBody = (await resp.text()).slice(0, 2048); // First 2KB only
    status = resp.ok ? 'success' : 'failed';
  } catch (err: unknown) {
    responseBody = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startMs;

  // Write delivery log
  await withTenantContext(client, tenantId, async (txDb) =>
    txDb.insert(webhookDeliveries).values({
      tenantId,
      endpointId: endpoint.id,
      eventType,
      payload,
      responseStatus,
      responseBody,
      status,
      attempt: 1,
      durationMs,
    }),
  );

  // Update endpoint stats
  if (status === 'success') {
    await withTenantContext(client, tenantId, async (txDb) =>
      txDb.update(webhookEndpoints)
        .set({ lastDeliveredAt: new Date(), failureCount: 0 })
        .where(eq(webhookEndpoints.id, endpoint.id)),
    );
  } else {
    // Increment failure count — auto-disable after 10 consecutive failures
    await withTenantContext(client, tenantId, async (txDb) => {
      const [row] = await txDb.select({ failureCount: webhookEndpoints.failureCount })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, endpoint.id))
        .limit(1);

      const newCount = (row?.failureCount ?? 0) + 1;
      const updates: Record<string, unknown> = { failureCount: newCount };
      if (newCount >= 10) {
        updates.status = 'disabled';
      }

      await txDb.update(webhookEndpoints)
        .set(updates)
        .where(eq(webhookEndpoints.id, endpoint.id));
    });
  }
}

// ── Fire-and-forget dispatcher ────────────────────────────────────────────────
/**
 * Dispatch a webhook event to all matching tenant endpoints.
 * Fire-and-forget — never throws, never blocks.
 *
 * Call WITHOUT await:
 *   dispatchWebhook({ tenantId: '...', eventType: 'document.created', payload: { ... } });
 */
export function dispatchWebhook(event: WebhookEvent): void {
  void _dispatch(event).catch((err: unknown) => {
    console.error(JSON.stringify({
      event: 'WebhookDispatchError',
      error: err instanceof Error ? err.message : String(err),
      eventType: event.eventType,
      tenantId: event.tenantId,
    }));
  });
}

async function _dispatch(event: WebhookEvent): Promise<void> {
  const { tenantId, eventType, payload } = event;
  const { client } = await getDb();

  // Find all active endpoints subscribed to this event type
  const endpoints = await withTenantContext(client, tenantId, async (txDb) =>
    txDb.select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
    })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.tenantId, tenantId),
        eq(webhookEndpoints.status, 'active'),
        arrayContains(webhookEndpoints.eventTypes, [eventType]),
      ),
    ),
  );

  if (endpoints.length === 0) return;

  // Deliver to all matching endpoints in parallel
  const results = await Promise.allSettled(
    endpoints.map((ep) => deliverToEndpoint(tenantId, ep, eventType, payload)),
  );

  // Log any failures (for CloudWatch)
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(JSON.stringify({
        event: 'WebhookDeliveryError',
        endpointId: endpoints[i]!.id,
        error: String(result.reason),
        eventType,
        tenantId,
      }));
    }
  }
}
