/**
 * Ghost Trigger Lambda — entry point dispatcher.
 *
 * Routes:
 *   POST /api/v1/ghost/trigger — JWT protected, admin role required
 *
 * Invokes the Ghost Lambda (aisentinels-ghost-prod) asynchronously.
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { trigger } from './trigger.ts';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method === 'POST' && path === '/api/v1/ghost/trigger') {
      return trigger(event);
    }

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ event: 'GhostTriggerHandlerError', error: String(err), method, path }));
    return json(500, { error: message });
  }
};
