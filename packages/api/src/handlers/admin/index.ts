/**
 * Admin Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/admin/* routes.
 * All routes require JWT + admin role (enforced per handler).
 *
 * Routes handled:
 *   POST /api/v1/admin/billing/activate → activateTenant (JWT + admin role)
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { activateTenant } from './activate-tenant.ts';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method === 'POST' && path === '/api/v1/admin/billing/activate') {
      return activateTenant(event);
    }

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ event: 'AdminHandlerError', error: String(err), method, path }));
    return json(500, { error: message });
  }
};
