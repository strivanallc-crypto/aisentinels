import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { users, userRoles, orgRoles } from '@aisentinels/db/schema';
import { eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function getUsers(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const { client } = await getDb();

  const result = await withTenantContext(client, tenantId, async (txDb) => {
    // Get users
    const tenantUsers = await txDb
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // Get role assignments with role names
    const roleAssignments = await txDb
      .select({
        userId: userRoles.userId,
        roleId: userRoles.roleId,
        roleName: orgRoles.roleName,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(orgRoles, eq(userRoles.roleId, orgRoles.id))
      .where(eq(userRoles.tenantId, tenantId));

    // Merge users with their roles
    return tenantUsers.map((user) => ({
      ...user,
      orgRoles: roleAssignments.filter((r) => r.userId === user.id),
    }));
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
