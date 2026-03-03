import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { auditSessions } from '@aisentinels/db/schema';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { CreateAuditSchema, parseBody } from '../../lib/validate.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function createAudit(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  const parsed = parseBody(CreateAuditSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { title, auditType, scope, auditDate, clauseRefs } = parsed.data;

  const { client } = await getDb();

  const [session] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .insert(auditSessions)
      .values({
        tenantId,
        title,
        auditType:  auditType as typeof auditSessions.$inferInsert['auditType'],
        scope,
        auditDate:  new Date(auditDate),
        clauseRefs,
        status:     'scheduled',
      })
      .returning(),
  );

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  };
}
