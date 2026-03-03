import { createHash } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { vaultRecords } from '@aisentinels/db/schema';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { CreateRecordSchema, parseBody } from '../../lib/validate.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function createRecord(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(CreateRecordSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { title, category, retentionYears, contentText } = parsed.data;

  const content = contentText?.trim() ?? null;

  // Compute SHA-256 of content for tamper detection
  const sha256Hash = content
    ? createHash('sha256').update(content, 'utf8').digest('hex')
    : null;

  // Retention expiry: now + retentionYears years (approximate: 365.25 days/yr)
  const retentionExpiresAt = new Date(
    Date.now() + retentionYears * 365.25 * 24 * 3600 * 1000,
  );

  const { client } = await getDb();

  const [record] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .insert(vaultRecords)
      .values({
        tenantId,
        title,
        category:           category as typeof vaultRecords.$inferInsert['category'],
        retentionYears,
        retentionExpiresAt,
        legalHold:          false,
        contentText:        content,
        sha256Hash,
        createdBy:          sub,
      })
      .returning(),
  );

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  };
}
