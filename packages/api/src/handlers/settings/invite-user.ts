import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { users, userRoles, orgRoles } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { InviteUserSchema, parseBody } from '../../lib/validate.ts';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? '';

const cognito = new CognitoIdentityProviderClient({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function inviteUser(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(InviteUserSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { email, roleId } = parsed.data;

  const { client } = await getDb();

  const result = await withTenantContext(client, tenantId, async (txDb) => {
    // Verify role exists for this tenant
    const [role] = await txDb
      .select()
      .from(orgRoles)
      .where(and(eq(orgRoles.tenantId, tenantId), eq(orgRoles.id, roleId)))
      .limit(1);

    if (!role) {
      return { error: 'Role not found', statusCode: 404 };
    }

    // Create Cognito user if USER_POOL_ID is set (prod)
    let cognitoSub = email; // fallback: use email as ID if no Cognito
    if (USER_POOL_ID) {
      try {
        const createResult = await cognito.send(new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:tenantId', Value: tenantId },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }));
        cognitoSub = createResult.User?.Attributes?.find(a => a.Name === 'sub')?.Value ?? email;
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error.name === 'UsernameExistsException') {
          return { error: 'User with this email already exists', statusCode: 409 };
        }
        throw err;
      }
    }

    // Create user in our DB
    const [newUser] = await txDb
      .insert(users)
      .values({
        tenantId,
        cognitoSub,
        email,
        firstName: email.split('@')[0] ?? '',
        lastName: '',
        role: 'viewer',
        status: 'invited',
      })
      .returning();

    // Look up the actor's DB id from their Cognito sub (assigned_by FK → users.id)
    const [actor] = await txDb
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.cognitoSub, sub)))
      .limit(1);

    // Assign the role
    await txDb.insert(userRoles).values({
      tenantId,
      userId: newUser!.id,
      roleId,
      assignedBy: actor?.id ?? null,
    });

    return { user: newUser, roleName: role.roleName };
  });

  if (result && 'error' in result) {
    return {
      statusCode: (result as { statusCode: number }).statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: (result as { error: string }).error }),
    };
  }

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
}
