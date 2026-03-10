/**
 * GET /api/v1/management-reviews — placeholder handler.
 *
 * Management review feature not yet implemented. Returns an empty array
 * so the frontend dashboard does not receive 404/CORS errors.
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const { sub, tenantId } = extractClaims(event);

  logAuditEvent({
    eventType:  'management_review.list.viewed',
    entityType: 'management_review',
    entityId:   'list',
    actorId:    sub,
    tenantId,
    action:     'REVIEW',
    detail:     {},
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviews: [] }),
  };
};
