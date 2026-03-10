/**
 * Billing Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/billing/* routes.
 * Routes by HTTP method + rawPath to individual operation modules.
 *
 * Routes handled:
 *   GET  /api/v1/billing/subscription  → getSubscription  (JWT protected)
 *   GET  /api/v1/billing/usage         → getBillingUsage  (JWT protected)
 *   POST /api/v1/billing/upgrade       → upgradePlan      (JWT protected)
 *   POST /api/v1/billing/signup        → signup           (public — no JWT)
 *   POST /api/v1/billing/wise/webhook  → wiseWebhook      (public — no JWT)
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getSubscription }  from './get-subscription.ts';
import { getBillingUsage }  from './get-usage.ts';
import { upgradePlan }      from './upgrade-plan.ts';
import { wiseWebhook }      from './wise-webhook.ts';
import { signup }           from './signup.ts';

// The handler must satisfy both the JWT and non-JWT event shapes because the
// Wise webhook route has HttpNoneAuthorizer (no JWT context injected).
// We cast accordingly per route.
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // GET /api/v1/billing/subscription
    if (method === 'GET' && path === '/api/v1/billing/subscription') {
      return getSubscription(event as Parameters<APIGatewayProxyHandlerV2WithJWTAuthorizer>[0]);
    }

    // GET /api/v1/billing/usage
    if (method === 'GET' && path === '/api/v1/billing/usage') {
      return getBillingUsage(event as Parameters<APIGatewayProxyHandlerV2WithJWTAuthorizer>[0]);
    }

    // POST /api/v1/billing/upgrade
    if (method === 'POST' && path === '/api/v1/billing/upgrade') {
      return upgradePlan(event as Parameters<APIGatewayProxyHandlerV2WithJWTAuthorizer>[0]);
    }

    // POST /api/v1/billing/signup  (public — no JWT)
    if (method === 'POST' && path === '/api/v1/billing/signup') {
      return signup(event);
    }

    // POST /api/v1/billing/wise/webhook  (public — no JWT)
    if (method === 'POST' && path === '/api/v1/billing/wise/webhook') {
      return wiseWebhook(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'BillingError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
