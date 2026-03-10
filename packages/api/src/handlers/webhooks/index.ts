/**
 * Webhooks Lambda — Phase 14 entry point dispatcher.
 *
 * Routes handled (JWT + admin/owner role required):
 *   POST   /api/v1/settings/webhooks             → createEndpoint
 *   GET    /api/v1/settings/webhooks              → listEndpoints
 *   GET    /api/v1/settings/webhooks/{id}         → getEndpoint (with recent deliveries)
 *   PUT    /api/v1/settings/webhooks/{id}         → updateEndpoint
 *   DELETE /api/v1/settings/webhooks/{id}         → deleteEndpoint
 *   POST   /api/v1/settings/webhooks/{id}/test    → testEndpoint
 */
import type {
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { webhookEndpoints, webhookDeliveries } from '@aisentinels/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { z } from 'zod';

// ── DB singleton ──────────────────────────────────────────────────────────────
let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

const json = (statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── Secret generator (32 bytes hex) ───────────────────────────────────────────
function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'whsec_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Supported event types ─────────────────────────────────────────────────────
const VALID_EVENT_TYPES = [
  'document.created', 'document.approved', 'document.rejected',
  'audit.created', 'audit.completed',
  'capa.created', 'capa.closed',
  'finding.created',
  'record.created', 'record.verified',
  'compliance.check_completed',
] as const;

// ── Validation ───────────────────────────────────────────────────────────────
const CreateWebhookSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.enum(VALID_EVENT_TYPES)).min(1),
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.enum(VALID_EVENT_TYPES)).min(1).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAdminOrOwner(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const claims = extractClaims(event);
  if (claims.role !== 'admin' && claims.role !== 'owner') {
    return { claims: null, error: json(403, { error: 'Forbidden — admin or owner role required' }) };
  }
  return { claims, error: null };
}

// ── Extract ID from path ─────────────────────────────────────────────────────
function extractId(path: string): string {
  // /api/v1/settings/webhooks/{id} or /api/v1/settings/webhooks/{id}/test
  const segments = path.split('/');
  // webhooks is at index 5, id is at index 6
  return segments[6]!;
}

// ── POST /api/v1/settings/webhooks ───────────────────────────────────────────
async function handleCreate(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const { claims, error } = requireAdminOrOwner(event);
  if (!claims) return error!;

  const body = JSON.parse(event.body ?? '{}');
  const parsed = CreateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid input', details: parsed.error.flatten() });
  }

  const secret = generateSecret();
  const { client } = await getDb();

  const [row] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.insert(webhookEndpoints).values({
      tenantId: claims.tenantId,
      url: parsed.data.url,
      description: parsed.data.description ?? null,
      secret,
      eventTypes: parsed.data.eventTypes as string[],
      createdBy: claims.sub,
    }).returning(),
  );

  logAuditEvent({
    eventType: 'webhook.created',
    entityType: 'org',
    entityId: row!.id,
    actorId: claims.sub,
    actorEmail: claims.email,
    tenantId: claims.tenantId,
    action: 'CREATE',
    detail: { url: parsed.data.url, eventTypes: parsed.data.eventTypes },
  });

  return json(201, {
    webhook: {
      id: row!.id,
      url: row!.url,
      description: row!.description,
      eventTypes: row!.eventTypes,
      status: row!.status,
      createdAt: row!.createdAt,
      // Secret shown ONCE on creation
      secret,
    },
  });
}

// ── GET /api/v1/settings/webhooks ────────────────────────────────────────────
async function handleList(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const { claims, error } = requireAdminOrOwner(event);
  if (!claims) return error!;

  const { client } = await getDb();

  const rows = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      description: webhookEndpoints.description,
      eventTypes: webhookEndpoints.eventTypes,
      status: webhookEndpoints.status,
      failureCount: webhookEndpoints.failureCount,
      lastDeliveredAt: webhookEndpoints.lastDeliveredAt,
      createdAt: webhookEndpoints.createdAt,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.tenantId, claims.tenantId))
    .orderBy(webhookEndpoints.createdAt),
  );

  return json(200, { webhooks: rows });
}

// ── GET /api/v1/settings/webhooks/{id} ───────────────────────────────────────
async function handleGet(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const { claims, error } = requireAdminOrOwner(event);
  if (!claims) return error!;

  const id = extractId(event.rawPath);
  const { client } = await getDb();

  const [endpoint] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, claims.tenantId)))
      .limit(1),
  );

  if (!endpoint) return json(404, { error: 'Webhook endpoint not found' });

  // Fetch last 20 deliveries
  const deliveries = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.select({
      id: webhookDeliveries.id,
      eventType: webhookDeliveries.eventType,
      status: webhookDeliveries.status,
      responseStatus: webhookDeliveries.responseStatus,
      durationMs: webhookDeliveries.durationMs,
      attempt: webhookDeliveries.attempt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .where(and(
      eq(webhookDeliveries.endpointId, id),
      eq(webhookDeliveries.tenantId, claims.tenantId),
    ))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20),
  );

  // Omit secret from response (was only shown on creation)
  const { secret: _s, ...safeEndpoint } = endpoint;

  return json(200, { webhook: safeEndpoint, deliveries });
}

// ── PUT /api/v1/settings/webhooks/{id} ───────────────────────────────────────
async function handleUpdate(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const { claims, error } = requireAdminOrOwner(event);
  if (!claims) return error!;

  const id = extractId(event.rawPath);
  const body = JSON.parse(event.body ?? '{}');
  const parsed = UpdateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { client } = await getDb();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.url) updates.url = parsed.data.url;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.eventTypes) updates.eventTypes = parsed.data.eventTypes;
  if (parsed.data.status) {
    updates.status = parsed.data.status;
    if (parsed.data.status === 'active') updates.failureCount = 0; // Reset on re-enable
  }

  const [updated] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.update(webhookEndpoints)
      .set(updates)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, claims.tenantId)))
      .returning({ id: webhookEndpoints.id }),
  );

  if (!updated) return json(404, { error: 'Webhook endpoint not found' });

  logAuditEvent({
    eventType: 'webhook.updated',
    entityType: 'org',
    entityId: id,
    actorId: claims.sub,
    actorEmail: claims.email,
    tenantId: claims.tenantId,
    action: 'UPDATE',
    detail: parsed.data,
  });

  return json(200, { updated: true, id });
}

// ── DELETE /api/v1/settings/webhooks/{id} ────────────────────────────────────
async function handleDelete(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const { claims, error } = requireAdminOrOwner(event);
  if (!claims) return error!;

  const id = extractId(event.rawPath);
  const { client } = await getDb();

  const [deleted] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, claims.tenantId)))
      .returning({ id: webhookEndpoints.id }),
  );

  if (!deleted) return json(404, { error: 'Webhook endpoint not found' });

  logAuditEvent({
    eventType: 'webhook.deleted',
    entityType: 'org',
    entityId: id,
    actorId: claims.sub,
    actorEmail: claims.email,
    tenantId: claims.tenantId,
    action: 'DELETE',
    detail: { endpointId: id },
  });

  return json(200, { deleted: true, id });
}

// ── POST /api/v1/settings/webhooks/{id}/test ─────────────────────────────────
async function handleTest(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const { claims, error } = requireAdminOrOwner(event);
  if (!claims) return error!;

  const id = extractId(event.rawPath);
  const { client } = await getDb();

  const [endpoint] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.select({ id: webhookEndpoints.id, url: webhookEndpoints.url, secret: webhookEndpoints.secret })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, claims.tenantId)))
      .limit(1),
  );

  if (!endpoint) return json(404, { error: 'Webhook endpoint not found' });

  // Send test payload
  const testPayload = JSON.stringify({
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test webhook delivery from AI Sentinels' },
  });

  // Sign the payload
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(endpoint.secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(testPayload));
  const signature = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const startMs = Date.now();
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': 'webhook.test',
      },
      body: testPayload,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    responseStatus = resp.status;
    responseBody = (await resp.text()).slice(0, 2048);
    success = resp.ok;
  } catch (err: unknown) {
    responseBody = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startMs;

  // Log test delivery
  await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.insert(webhookDeliveries).values({
      tenantId: claims.tenantId,
      endpointId: id,
      eventType: 'webhook.test',
      payload: { message: 'Test delivery' },
      responseStatus,
      responseBody,
      status: success ? 'success' : 'failed',
      attempt: 1,
      durationMs,
    }),
  );

  return json(200, { success, responseStatus, durationMs, responseBody: responseBody?.slice(0, 500) });
}

// ── Lambda handler ───────────────────────────────────────────────────────────
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    // POST /api/v1/settings/webhooks
    if (method === 'POST' && path === '/api/v1/settings/webhooks') {
      return handleCreate(event);
    }

    // GET /api/v1/settings/webhooks (list)
    if (method === 'GET' && path === '/api/v1/settings/webhooks') {
      return handleList(event);
    }

    // POST /api/v1/settings/webhooks/{id}/test
    if (method === 'POST' && path.endsWith('/test') && path.startsWith('/api/v1/settings/webhooks/')) {
      return handleTest(event);
    }

    // GET /api/v1/settings/webhooks/{id}
    if (method === 'GET' && path.startsWith('/api/v1/settings/webhooks/')) {
      return handleGet(event);
    }

    // PUT /api/v1/settings/webhooks/{id}
    if (method === 'PUT' && path.startsWith('/api/v1/settings/webhooks/')) {
      return handleUpdate(event);
    }

    // DELETE /api/v1/settings/webhooks/{id}
    if (method === 'DELETE' && path.startsWith('/api/v1/settings/webhooks/')) {
      return handleDelete(event);
    }

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ event: 'WebhooksHandlerError', error: String(err), method, path }));
    return json(500, { error: message });
  }
};
