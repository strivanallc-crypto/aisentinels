/**
 * POST /api/v1/tenants/provision — protected (JWT required).
 *
 * Called once from the frontend during the post-signup onboarding flow.
 * Creates the tenant, owner user, and starter trial subscription in a single
 * RLS-scoped transaction.
 *
 * All three inserts use onConflictDoNothing() — safe to retry if the
 * frontend re-submits (e.g. network timeout):
 *   • tenants    — conflict on PK (tenantId from JWT)
 *   • users      — conflict on unique cognitoSub
 *   • subscriptions — only inserted when user row is newly created,
 *                     preventing duplicate trial subscriptions on retry
 *
 * DB connection uses IAM auth via RDS Proxy.
 * Connection singleton is reused across warm Lambda invocations.
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { tenants, users, subscriptions } from '@aisentinels/db/schema';
import { withTenantContext } from '../middleware/tenant-context.ts';
import { extractClaims } from '../middleware/auth-context.ts';

// Module-scope singleton — reused across warm Lambda invocations to avoid
// per-request IAM token fetch and connection setup latency.
let _dbInstance: Awaited<ReturnType<typeof createDb>> | null = null;

async function getDbInstance(): Promise<Awaited<ReturnType<typeof createDb>>> {
  if (!_dbInstance) {
    _dbInstance = await createDb({ iamAuth: true });
  }
  return _dbInstance;
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const { sub, email, tenantId, role } = extractClaims(event);

    // Parse optional body for custom name/slug overrides
    let parsedBody: { name?: string; slug?: string } = {};
    if (event.body) {
      try {
        parsedBody = JSON.parse(event.body) as { name?: string; slug?: string };
      } catch {
        // Ignore malformed body — fall through to defaults
      }
    }

    // Derive display name and URL-safe slug from email if not provided.
    // Slug includes a tenantId prefix to guarantee uniqueness across tenants
    // that share the same email domain (e.g. gmail.com).
    const emailParts = email.split('@');
    const localPart = emailParts[0] ?? 'user';
    const domainPart = emailParts[1] ?? '';
    const domainPrefix = domainPart.split('.')[0] ?? 'tenant';

    const name = parsedBody.name ?? localPart;
    const slug = parsedBody.slug ?? `${domainPrefix}-${tenantId.slice(0, 8)}`;
    const firstName = localPart;
    const lastName = '';

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000); // 14-day trial

    const { client } = await getDbInstance();

    let userId: string | undefined;

    await withTenantContext(client, tenantId, async (txDb) => {
      // 1. Upsert tenant row — idempotent on PK (tenantId is the UUID from JWT)
      await txDb
        .insert(tenants)
        .values({ id: tenantId, name, slug, status: 'trial' })
        .onConflictDoNothing();

      // 2. Upsert user row — idempotent on unique cognitoSub; returns id only on first insert
      const [newUser] = await txDb
        .insert(users)
        .values({
          tenantId,
          cognitoSub: sub,
          email,
          firstName,
          lastName,
          role: 'owner', // provision endpoint always creates the initial tenant owner
          status: 'active',
        })
        .onConflictDoNothing()
        .returning({ id: users.id });

      userId = newUser?.id;

      // 3. Insert subscription only on first provision — prevents duplicate trial rows on retry
      if (newUser) {
        await txDb
          .insert(subscriptions)
          .values({
            tenantId,
            plan: 'starter',
            status: 'trial',
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
            aiCreditsLimit: 100,
          })
          .onConflictDoNothing();
      }
    });

    console.log(
      JSON.stringify({
        event: 'TenantProvision',
        tenantId,
        userId,
        isFirstProvision: userId !== undefined,
      }),
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        userId,
        trialEndsAt: trialEndsAt.toISOString(),
      }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'TenantProvisionError', error: String(err) }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
