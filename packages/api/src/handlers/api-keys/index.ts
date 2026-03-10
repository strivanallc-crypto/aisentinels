/**
 * API Keys Lambda — Phase 14 entry point dispatcher.
 *
 * Routes handled (JWT + admin/owner role required):
 *   POST   /api/v1/settings/api-keys          → createApiKey
 *   GET    /api/v1/settings/api-keys           → listApiKeys
 *   DELETE /api/v1/settings/api-keys/{keyId}   → revokeApiKey
 */
import type {
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { apiKeys } from '@aisentinels/db/schema';
import { eq, and } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { z } from 'zod';

// ── DynamoDB singleton ───────────────────────────────────────────────────────
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

// ── Nano ID generator (48 chars for API key) ──────────────────────────────────
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateApiKey(): string {
  const prefix = 'ask_live_';
  const bytes = new Uint8Array(40);
  crypto.getRandomValues(bytes);
  let key = '';
  for (let i = 0; i < 40; i++) {
    key += KEY_ALPHABET[bytes[i]! % KEY_ALPHABET.length];
  }
  return prefix + key; // 49 chars total
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Validation ───────────────────────────────────────────────────────────────
const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string().min(1).max(100)).default([]),
  expiresAt: z.string().datetime().optional(),
});

// ── POST /api/v1/settings/api-keys ───────────────────────────────────────────
async function handleCreate(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const claims = extractClaims(event);
  if (claims.role !== 'admin' && claims.role !== 'owner') {
    return json(403, { error: 'Forbidden — admin or owner role required' });
  }

  const body = JSON.parse(event.body ?? '{}');
  const parsed = CreateApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid input', details: parsed.error.flatten() });
  }

  const rawKey = generateApiKey();
  const keyHash = await sha256Hex(rawKey);
  const prefix = rawKey.slice(0, 8);
  const last4 = rawKey.slice(-4);

  const { client } = await getDb();

  const [row] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.insert(apiKeys).values({
      tenantId: claims.tenantId,
      name: parsed.data.name,
      prefix,
      last4,
      keyHash,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdBy: claims.sub,
    }).returning(),
  );

  logAuditEvent({
    eventType: 'api_key.created',
    entityType: 'org',
    entityId: row!.id,
    actorId: claims.sub,
    actorEmail: claims.email,
    tenantId: claims.tenantId,
    action: 'CREATE',
    detail: { name: parsed.data.name, scopes: parsed.data.scopes },
  });

  return json(201, {
    apiKey: {
      id: row!.id,
      name: row!.name,
      prefix: row!.prefix,
      last4: row!.last4,
      scopes: row!.scopes,
      expiresAt: row!.expiresAt,
      createdAt: row!.createdAt,
      // The raw key — shown ONCE, never stored
      key: rawKey,
    },
  });
}

// ── GET /api/v1/settings/api-keys ────────────────────────────────────────────
async function handleList(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const claims = extractClaims(event);
  if (claims.role !== 'admin' && claims.role !== 'owner') {
    return json(403, { error: 'Forbidden — admin or owner role required' });
  }

  const { client } = await getDb();

  const rows = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      last4: apiKeys.last4,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      revoked: apiKeys.revoked,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, claims.tenantId))
    .orderBy(apiKeys.createdAt),
  );

  return json(200, { apiKeys: rows });
}

// ── DELETE /api/v1/settings/api-keys/{keyId} ─────────────────────────────────
async function handleRevoke(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const claims = extractClaims(event);
  if (claims.role !== 'admin' && claims.role !== 'owner') {
    return json(403, { error: 'Forbidden — admin or owner role required' });
  }

  // Extract keyId from path: /api/v1/settings/api-keys/{keyId}
  const segments = event.rawPath.split('/');
  const keyId = segments[segments.length - 1]!;

  const { client } = await getDb();

  const [updated] = await withTenantContext(client, claims.tenantId, async (txDb) =>
    txDb.update(apiKeys)
      .set({ revoked: true, revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, claims.tenantId)))
      .returning({ id: apiKeys.id }),
  );

  if (!updated) {
    return json(404, { error: 'API key not found' });
  }

  logAuditEvent({
    eventType: 'api_key.revoked',
    entityType: 'org',
    entityId: keyId,
    actorId: claims.sub,
    actorEmail: claims.email,
    tenantId: claims.tenantId,
    action: 'DEACTIVATE',
    detail: { keyId },
  });

  return json(200, { revoked: true, keyId });
}

// ── Lambda handler ───────────────────────────────────────────────────────────
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method === 'POST' && path === '/api/v1/settings/api-keys') {
      return handleCreate(event);
    }
    if (method === 'GET' && path === '/api/v1/settings/api-keys') {
      return handleList(event);
    }
    if (method === 'DELETE' && path.startsWith('/api/v1/settings/api-keys/')) {
      return handleRevoke(event);
    }

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ event: 'ApiKeysHandlerError', error: String(err), method, path }));
    return json(500, { error: message });
  }
};
