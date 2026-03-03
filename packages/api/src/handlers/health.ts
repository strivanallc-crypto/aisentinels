/**
 * GET /health — public endpoint (no JWT required).
 *
 * Returns a JSON health check payload.
 * Used by load balancers, monitoring, and post-deploy smoke tests.
 * Route is wired with HttpNoneAuthorizer to override the default JWT authorizer.
 */
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'ok',
    version: '1.0.0',
    ts: new Date().toISOString(),
  }),
});
