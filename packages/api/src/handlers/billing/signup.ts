/**
 * POST /api/v1/billing/signup — Self-service tenant signup.
 *
 * Public route (no JWT required). Creates:
 *   1. Cognito user (email + permanent password)
 *   2. Tenant row (status = trial)
 *   3. Users row (role = owner)
 *   4. Subscription row (status = trial, pending Wise payment)
 *   5. Wise invoice → returns payment URL
 *   6. Welcome email (fire-and-forget)
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';
import { createDb } from '@aisentinels/db';
import { tenants, subscriptions, users } from '@aisentinels/db/schema';
import { eq } from 'drizzle-orm';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { sendEmail, FROM_NOTIFICATIONS } from '../../lib/mailer.ts';
import { welcomeTemplate } from '../../lib/email-templates.ts';

// ── Config ──────────────────────────────────────────────────────────────────
const REGION        = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const USER_POOL_ID  = process.env.COGNITO_USER_POOL_ID ?? '';
const WISE_API_KEY  = process.env.WISE_API_KEY ?? '';
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID ?? '';
const APP_URL       = process.env.APP_URL ?? 'https://aisentinels.io';

const cognito = new CognitoIdentityProviderClient({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Plan pricing ────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  starter:      { amount: 597,  credits: 50,  users: 3,  standards: 1 },
  professional: { amount: 1397, credits: 200, users: 10, standards: 2 },
  enterprise:   { amount: 2497, credits: 500, users: 25, standards: 3 },
} as const;

type PlanKey = keyof typeof PLAN_CONFIG;

// ── Validation ──────────────────────────────────────────────────────────────
const SignupSchema = z.object({
  fullName:    z.string().min(1).max(200).transform((s) => s.trim()),
  companyName: z.string().min(1).max(200).transform((s) => s.trim()),
  email:       z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
  password:    z.string().min(8).max(128),
  industry:    z.string().min(1).max(100).transform((s) => s.trim()),
  plan:        z.enum(['starter', 'professional', 'enterprise']),
});

// ── Slug helper ─────────────────────────────────────────────────────────────
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    + '-' + Math.random().toString(36).slice(2, 8);
}

// ── JSON response helper ────────────────────────────────────────────────────
function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── Wise invoice creation ───────────────────────────────────────────────────
interface WiseQuoteResponse {
  id: string;
}

interface WisePaymentResponse {
  id: string;
  redirectUrl?: string;
}

async function createWisePaymentRequest(
  tenantId: string,
  companyName: string,
  email: string,
  plan: PlanKey,
): Promise<{ wiseInvoiceId: string; paymentUrl: string } | null> {
  if (!WISE_API_KEY || !WISE_PROFILE_ID) {
    console.error(JSON.stringify({ event: 'SignupWiseError', error: 'WISE_API_KEY or WISE_PROFILE_ID not set' }));
    return null;
  }

  const config = PLAN_CONFIG[plan];
  const headers = {
    'Authorization': `Bearer ${WISE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Create a quote for the payment amount
    const quoteRes = await fetch('https://api.wise.com/v2/profiles/' + WISE_PROFILE_ID + '/quotes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        sourceAmount: config.amount,
        targetAmount: null,
        payOut: 'BALANCE',
      }),
    });

    if (!quoteRes.ok) {
      console.error(JSON.stringify({
        event: 'SignupWiseQuoteError',
        status: quoteRes.status,
        body: await quoteRes.text(),
      }));
      return null;
    }

    const quote = await quoteRes.json() as WiseQuoteResponse;

    // Create a payment request (invoice) that the customer pays
    const invoiceRes = await fetch('https://api.wise.com/v1/profiles/' + WISE_PROFILE_ID + '/payment-requests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        sourceAmount: config.amount,
        quoteId: quote.id,
        reference: `AI Sentinels ${plan} — ${tenantId}`,
        customerEmail: email,
        customerName: companyName,
        redirectUrl: `${APP_URL}/signup/confirmed`,
      }),
    });

    if (!invoiceRes.ok) {
      console.error(JSON.stringify({
        event: 'SignupWiseInvoiceError',
        status: invoiceRes.status,
        body: await invoiceRes.text(),
      }));
      return null;
    }

    const invoice = await invoiceRes.json() as WisePaymentResponse;
    const paymentUrl = invoice.redirectUrl
      ?? `https://wise.com/pay/r/${invoice.id}`;

    return { wiseInvoiceId: invoice.id, paymentUrl };
  } catch (err) {
    console.error(JSON.stringify({ event: 'SignupWiseError', error: String(err) }));
    return null;
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
export async function signup(event: APIGatewayProxyEventV2) {
  // ── Parse + validate body ──────────────────────────────────────────────────
  let body: z.infer<typeof SignupSchema>;
  try {
    const raw = JSON.parse(event.body ?? '{}');
    body = SignupSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return json(400, { error: 'Validation failed', issues: err.issues });
    }
    return json(400, { error: 'Invalid JSON body' });
  }

  const { fullName, companyName, email, password, industry, plan } = body;
  const [firstName, ...lastParts] = fullName.split(' ');
  const lastName = lastParts.join(' ') || '';

  // ── Check if email already exists in Cognito ──────────────────────────────
  try {
    await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    }));
    // If we reach here, user exists
    return json(409, { error: 'An account with this email already exists' });
  } catch (err: unknown) {
    const errName = (err as { name?: string })?.name;
    if (errName !== 'UserNotFoundException') {
      console.error(JSON.stringify({ event: 'SignupCognitoCheckError', error: String(err) }));
      return json(500, { error: 'Unable to verify email availability' });
    }
    // UserNotFoundException = email is available → proceed
  }

  // ── Create Cognito user ───────────────────────────────────────────────────
  let cognitoSub: string;
  try {
    const createRes = await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      MessageAction: 'SUPPRESS', // Don't send Cognito's default email
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
        { Name: 'custom:company_name', Value: companyName },
        { Name: 'custom:industry', Value: industry },
      ],
    }));

    cognitoSub = createRes.User?.Attributes?.find(a => a.Name === 'sub')?.Value ?? '';
    if (!cognitoSub) throw new Error('No sub returned from Cognito');

    // Set permanent password (skips force-reset flow)
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    }));
  } catch (err) {
    console.error(JSON.stringify({ event: 'SignupCognitoCreateError', error: String(err) }));
    return json(500, { error: 'Account creation failed. Please try again.' });
  }

  // ── Create tenant + subscription + user in DB ─────────────────────────────
  const slug = toSlug(companyName);
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const planConfig = PLAN_CONFIG[plan];

  let tenantId: string;
  try {
    const { db } = await getDb();

    // Insert tenant (no RLS context needed — new tenant doesn't exist yet)
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: companyName,
        slug,
        status: 'trial',
        settings: { industry },
      })
      .returning({ id: tenants.id });

    tenantId = newTenant!.id;

    // Insert owner user
    await db.insert(users).values({
      tenantId,
      cognitoSub,
      email,
      firstName: firstName ?? '',
      lastName,
      role: 'owner',
      status: 'active',
    });

    // Insert subscription (pending payment)
    await db.insert(subscriptions).values({
      tenantId,
      plan: plan as typeof subscriptions.$inferInsert['plan'],
      status: 'trial',
      aiCreditsLimit: planConfig.credits,
      aiCreditsUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'SignupDbError', error: String(err) }));
    return json(500, { error: 'Account setup failed. Please contact support.' });
  }

  // ── Create Wise invoice ───────────────────────────────────────────────────
  const wise = await createWisePaymentRequest(tenantId, companyName, email, plan);

  if (wise) {
    // Update subscription with Wise invoice ID
    try {
      const { db } = await getDb();
      await db
        .update(subscriptions)
        .set({ wiseInvoiceId: wise.wiseInvoiceId, updatedAt: now })
        .where(eq(subscriptions.tenantId, tenantId));
    } catch (err) {
      console.error(JSON.stringify({ event: 'SignupWiseDbUpdateError', error: String(err) }));
    }
  }

  // ── Send welcome email (fire-and-forget) ──────────────────────────────────
  const emailData = welcomeTemplate({ orgName: companyName, userEmail: email });
  sendEmail({
    ...emailData,
    to: email,
    from: FROM_NOTIFICATIONS,
  });

  // ── Audit log (fire-and-forget) ───────────────────────────────────────────
  logAuditEvent({
    eventType:  'billing.signup.created',
    entityType: 'billing',
    entityId:   tenantId,
    actorId:    cognitoSub,
    actorEmail: email,
    tenantId,
    action:     'CREATE',
    detail:     { plan, companyName, industry },
    severity:   'info',
  });

  // ── Return redirect URL ───────────────────────────────────────────────────
  if (wise) {
    return json(200, { redirectUrl: wise.paymentUrl, tenantId });
  }

  // Wise failed but account was created
  return json(200, {
    redirectUrl: `${APP_URL}/signup/confirmed`,
    tenantId,
    warning: 'Account created. Payment setup is pending — you will receive an invoice by email.',
  });
}
