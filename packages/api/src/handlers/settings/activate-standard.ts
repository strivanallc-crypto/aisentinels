import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { orgStandards, users } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { ActivateStandardSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const STANDARD_TO_SENTINEL: Record<string, string> = {
  'ISO 9001': 'Qualy',
  'ISO 14001': 'Envi',
  'ISO 45001': 'Saffy',
};

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function activateStandard(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(ActivateStandardSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { standardCode } = parsed.data;

  const { client } = await getDb();

  const result = await withTenantContext(client, tenantId, async (txDb) => {
    // Idempotent: check if already activated
    const existing = await txDb
      .select()
      .from(orgStandards)
      .where(and(eq(orgStandards.tenantId, tenantId), eq(orgStandards.standardCode, standardCode)))
      .limit(1);

    if (existing.length > 0) {
      return { activated: true, alreadyActive: true, sentinelActivated: STANDARD_TO_SENTINEL[standardCode] ?? null };
    }

    // Look up the user's DB id from their Cognito sub (activated_by FK → users.id)
    const [actor] = await txDb
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.cognitoSub, sub)))
      .limit(1);

    await txDb.insert(orgStandards).values({
      tenantId,
      standardCode,
      activatedBy: actor?.id ?? null,
    });

    return { activated: true, alreadyActive: false, sentinelActivated: STANDARD_TO_SENTINEL[standardCode] ?? null };
  });

  logAuditEvent({
    eventType:  'standard.activated',
    entityType: 'standard',
    entityId:   standardCode,
    actorId:    sub,
    tenantId,
    action:     'ACTIVATE',
    detail:     { standardCode, alreadyActive: (result as { alreadyActive?: boolean }).alreadyActive },
    standard:   standardCode,
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
