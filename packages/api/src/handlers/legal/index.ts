/**
 * Legal — API Gateway v2 Lambda dispatcher.
 *
 * Routes:
 *   POST /api/v1/legal/accept  → accept handler
 *   GET  /api/v1/legal/status  → status handler
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { accept } from './accept.ts';
import { status } from './status.ts';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  if (method === 'POST' && path.endsWith('/legal/accept')) {
    return accept(event);
  }
  if (method === 'GET' && path.endsWith('/legal/status')) {
    return status(event);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found', path, method }),
  };
};
