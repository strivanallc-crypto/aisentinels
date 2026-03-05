import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { users, userRoles, orgRoles } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { UpdateUserRoleSchema, parseBody } from '../../lib/validate.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function updateUserRole(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const path = event.rawPath;

  // Extract userId from path: /api/v1/settings/users/{userId}/role
  const segments = path.split('/');
  const roleIdx = segments.indexOf('role');
  const userId = roleIdx > 0 ? segments[roleIdx - 1] : undefined;

  if (!userId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing userId in path' }),
    };
  }

  const parsed = parseBody(UpdateUserRoleSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { roleId } = parsed.data;

  const { client } = await getDb();

  const result = await withTenantContext(client, tenantId, async (txDb) => {
    // Verify role exists
    const [role] = await txDb
      .select()
      .from(orgRoles)
      .where(and(eq(orgRoles.tenantId, tenantId), eq(orgRoles.id, roleId)))
      .limit(1);

    if (!role) return { error: 'Role not found' };

    // Remove existing roles for this user, then assign the new one
    await txDb
      .delete(userRoles)
      .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, userId)));

    // Look up the actor's DB id from their Cognito sub (assigned_by FK → users.id)
    const [actor] = await txDb
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.cognitoSub, sub)))
      .limit(1);

    const [assignment] = await txDb
      .insert(userRoles)
      .values({
        tenantId,
        userId,
        roleId,
        assignedBy: actor?.id ?? null,
      })
      .returning();

    return { updated: true, assignment, roleName: role.roleName };
  });

  if (result && 'error' in result) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: (result as { error: string }).error }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
