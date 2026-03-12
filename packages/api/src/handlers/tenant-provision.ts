/**
 * POST /api/v1/tenants/provision — protected (JWT required).
 * Also invocable directly by pre-token-generation trigger (fire-and-forget).
 *
 * Called once from the frontend during the post-signup onboarding flow,
 * or automatically by the pre-token-generation trigger when a new user
 * is detected (missing tenantId backfill path).
 *
 * Creates the tenant, owner user, and starter trial subscription in a single
 * RLS-scoped transaction.
 *
 * IMPORTANT — users.id is set to the Cognito sub (JWT sub claim):
 *   All downstream handlers use the JWT sub claim directly as a foreign key
 *   reference to users.id (e.g. documents.created_by, records.created_by).
 *   This MUST match — if users.id !== cognitoSub, FK constraints will fail.
 *
 * All three inserts use onConflictDoNothing() — safe to retry if the
 * frontend re-submits (e.g. network timeout) or if pre-token invokes
 * this Lambda on every login for the same user:
 *   • tenants    — conflict on PK (tenantId from JWT)
 *   • users      — conflict on unique cognitoSub
 *   • subscriptions — only inserted when user row is newly created,
 *                     preventing duplicate trial subscriptions on retry
 *
 * DB connection uses IAM auth via RDS Proxy.
 * Connection singleton is reused across warm Lambda invocations.
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { eq } from 'drizzle-orm';
import { createDb } from '@aisentinels/db';
import { tenants, users, subscriptions } from '@aisentinels/db/schema';
import { withTenantContext } from '../middleware/tenant-context.ts';
import { extractClaims } from '../middleware/auth-context.ts';

// ── Dual-source payload extraction ──────────────────────────────────────────
// Supports two event shapes:
//   1. API Gateway v2 JWT authorizer event (frontend POST)
//   2. Direct Lambda invocation from pre-token-generation trigger
interface ProvisionPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
}

function extractPayload(event: any): ProvisionPayload {
  // API Gateway v2 JWT authorizer event — claims nested in requestContext
  if (event?.requestContext?.authorizer?.jwt?.claims) {
    return extractClaims(event);
  }

  // Direct Lambda invocation from pre-token-generation trigger
  if (event?.source === 'pre-token-generation') {
    const { sub, email, tenantId, role } = event;
    if (!sub || !tenantId) {
      throw new Error(
        `Direct invoke missing required fields: sub=${sub}, tenantId=${tenantId}`,
      );
    }
    return { sub, email: email ?? '', tenantId, role: role ?? 'owner' };
  }

  throw new Error(
    `Unknown event source: ${JSON.stringify(event).slice(0, 200)}`,
  );
}

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
    const { sub, email, tenantId, role } = extractPayload(event);

    // Parse optional body for custom name/slug overrides
    let parsedBody: { name?: string; slug?: string } = {};
    if ((event as any).body) {
      try {
        parsedBody = JSON.parse((event as any).body) as { name?: string; slug?: string };
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
    let isNewUser = false;

    await withTenantContext(client, tenantId, async (txDb) => {
      // 1. Upsert tenant row — idempotent on PK (tenantId is the UUID from JWT)
      await txDb
        .insert(tenants)
        .values({ id: tenantId, name, slug, status: 'trial' })
        .onConflictDoNothing();

      // 2. Upsert user row — users.id MUST equal Cognito sub (JWT sub claim)
      //    so that downstream handlers can use `sub` directly as FK to users.id.
      //
      //    Check if user exists first to distinguish new vs existing users
      //    and to fix legacy rows where id !== cognitoSub.
      const [existingUser] = await txDb
        .select({ id: users.id })
        .from(users)
        .where(eq(users.cognitoSub, sub));

      if (existingUser) {
        // Fix legacy users provisioned before the id=sub fix:
        // update PK to match Cognito sub so FK references work.
        if (existingUser.id !== sub) {
          await txDb
            .update(users)
            .set({ id: sub })
            .where(eq(users.cognitoSub, sub));
          console.log(
            JSON.stringify({
              event: 'TenantProvision_FixUserId',
              tenantId,
              oldId: existingUser.id,
              newId: sub,
            }),
          );
        }
        userId = sub;
      } else {
        // New user — insert with id = sub (Cognito sub UUID as PK)
        isNewUser = true;
        const [newUser] = await txDb
          .insert(users)
          .values({
            id: sub,
            tenantId,
            cognitoSub: sub,
            email,
            firstName,
            lastName,
            role: 'owner', // provision endpoint always creates the initial tenant owner
            status: 'active',
          })
          .returning({ id: users.id });

        userId = newUser?.id;
      }

      // 3. Insert subscription only on first provision — prevents duplicate trial rows on retry
      if (isNewUser) {
        await txDb
          .insert(subscriptions)
          .values({
            tenantId,
            plan: 'starter',
            status: 'trial',
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
            aiCreditsLimit: 50,
          })
          .onConflictDoNothing();
      }
    });

    console.log(
      JSON.stringify({
        event: 'TenantProvision',
        tenantId,
        userId,
        isFirstProvision: isNewUser,
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
