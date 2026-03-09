import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { orgContext } from '@aisentinels/db/schema';
import { eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { UpdateOrgSchema, parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function updateOrg(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(UpdateOrgSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { companyName, industry, country, employeeCount, imsScope, certificationTargets } = parsed.data;

  const { client } = await getDb();

  const [row] = await withTenantContext(client, tenantId, async (txDb) => {
    // Check if org_context row exists
    const existing = await txDb.select().from(orgContext).where(eq(orgContext.tenantId, tenantId)).limit(1);

    if (existing.length > 0) {
      // Update existing row
      return txDb
        .update(orgContext)
        .set({
          companyName,
          industry,
          country,
          employeeCount,
          imsScope,
          certificationTargets: certificationTargets ?? [],
          updatedAt: new Date(),
        })
        .where(eq(orgContext.tenantId, tenantId))
        .returning();
    }

    // Insert new row (first visit / onboarding)
    return txDb
      .insert(orgContext)
      .values({
        tenantId,
        companyName,
        industry,
        country,
        employeeCount,
        imsScope,
        certificationTargets: certificationTargets ?? [],
      })
      .returning();
  });

  logAuditEvent({
    eventType:  'org.updated',
    entityType: 'org',
    entityId:   tenantId,
    actorId:    sub,
    tenantId,
    action:     'UPDATE',
    detail:     { companyName, industry, country },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  };
}
