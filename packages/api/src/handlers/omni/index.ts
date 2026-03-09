/**
 * Omni Lambda — entry point dispatcher.
 *
 * Routes:
 *   POST /api/v1/omni/orchestrate  — JWT protected (default authorizer)
 *   POST /api/v1/omni/approve      — public (token-based auth, no JWT)
 *
 * The handler must satisfy both JWT and non-JWT event shapes because the
 * approve route has HttpNoneAuthorizer (no JWT context injected).
 * We cast accordingly per route.
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { orchestrate } from './orchestrate.ts';
import { approve } from './approve.ts';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method !== 'POST') {
      return json(405, { error: `Method not allowed: ${method}` });
    }

    // POST /api/v1/omni/orchestrate — JWT protected
    if (path === '/api/v1/omni/orchestrate') {
      return orchestrate(event as Parameters<APIGatewayProxyHandlerV2WithJWTAuthorizer>[0]);
    }

    // POST /api/v1/omni/approve — token-based auth (no JWT)
    if (path === '/api/v1/omni/approve') {
      return approve(event);
    }

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    const message = err instanceof Error ? err.message : 'Internal server error';

    console.error(JSON.stringify({
      event: 'OmniHandlerError',
      error: String(err),
      method,
      path,
      statusCode,
    }));

    return json(statusCode, { error: message });
  }
};
