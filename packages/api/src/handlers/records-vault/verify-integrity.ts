import { createHash } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { vaultRecords } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function verifyIntegrity(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Path: /api/v1/records-vault/records/{id}/verify-integrity
  // Second-to-last segment is the record id
  const segments = event.rawPath.split('/');
  const id = segments.at(-2) ?? '';

  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing record id' }),
    };
  }

  const { client } = await getDb();

  const [record] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .select()
      .from(vaultRecords)
      .where(and(eq(vaultRecords.id, id), eq(vaultRecords.tenantId, tenantId))),
  );

  if (!record) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Record not found' }),
    };
  }

  if (!record.contentText) {
    return {
      statusCode: 409,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No content to verify â€” record has no stored text' }),
    };
  }

  const computed = createHash('sha256').update(record.contentText, 'utf8').digest('hex');

  if (computed !== record.sha256Hash) {
    return {
      statusCode: 409,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verified: false,
        error:    'Hash mismatch â€” record content has been modified',
        expected: record.sha256Hash,
        computed,
      }),
    };
  }

  // Mark verified
  const [updated] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(vaultRecords)
      .set({ integrityVerifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(vaultRecords.id, id), eq(vaultRecords.tenantId, tenantId)))
      .returning(),
  );

  logAuditEvent({
    eventType:  'record.integrity.verified',
    entityType: 'record',
    entityId:   id,
    actorId:    sub,
    tenantId,
    action:     'VERIFY',
    detail:     { verified: true },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified: true, record: updated }),
  };
}
