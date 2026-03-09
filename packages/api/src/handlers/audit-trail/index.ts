/**
 * Audit Trail Lambda — entry point dispatcher.
 *
 * Handles GET /api/v1/audit-trail — query audit events for the authenticated tenant.
 * DynamoDB-only (no RDS). Non-VPC for faster cold start.
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { getAuditTrail } from './query.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    if (method === 'GET' && path === '/api/v1/audit-trail') {
      return getAuditTrail(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'AuditTrailError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
