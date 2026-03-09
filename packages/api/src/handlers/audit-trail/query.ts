/**
 * GET /api/v1/audit-trail
 *
 * Query audit events for the authenticated tenant.
 * Supports filtering by entityId, entityType, date range, and pagination.
 *
 * Query parameters:
 *   entityId    — filter by specific record ID
 *   entityType  — filter by entity type (document, audit, capa, record, user, sentinel, billing, org, brain, standard)
 *   startDate   — ISO 8601 lower bound (inclusive)
 *   endDate     — ISO 8601 upper bound (inclusive)
 *   limit       — max results (1-200, default 50)
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractClaims } from '../../middleware/auth-context.ts';
import { queryAuditEvents } from '../../lib/audit-logger.ts';

export async function getAuditTrail(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  const qs = event.queryStringParameters ?? {};

  const entityId   = qs['entityId']   ?? undefined;
  const entityType = qs['entityType'] ?? undefined;
  const startDate  = qs['startDate']  ?? undefined;
  const endDate    = qs['endDate']    ?? undefined;
  const rawLimit   = qs['limit'];
  const limit      = rawLimit ? Math.min(Math.max(Number(rawLimit) || 50, 1), 200) : 50;

  // Validate entityType if provided
  const VALID_ENTITY_TYPES = [
    'document', 'audit', 'capa', 'record', 'user',
    'sentinel', 'billing', 'org', 'brain', 'standard',
  ];
  if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
      }),
    };
  }

  // Validate date formats if provided (basic ISO 8601 check)
  const isoDateRe = /^\d{4}-\d{2}-\d{2}/;
  if (startDate && !isoDateRe.test(startDate)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'startDate must be ISO 8601 format (YYYY-MM-DD...)' }),
    };
  }
  if (endDate && !isoDateRe.test(endDate)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'endDate must be ISO 8601 format (YYYY-MM-DD...)' }),
    };
  }

  try {
    const events = await queryAuditEvents({
      tenantId,
      entityId,
      entityType,
      startDate,
      endDate,
      limit,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        count: events.length,
        limit,
        filters: {
          ...(entityId   && { entityId }),
          ...(entityType && { entityType }),
          ...(startDate  && { startDate }),
          ...(endDate    && { endDate }),
        },
      }),
    };
  } catch (err) {
    console.error(JSON.stringify({
      event: 'AuditTrailQueryError',
      error: err instanceof Error ? err.message : String(err),
      tenantId,
    }));

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to query audit trail' }),
    };
  }
}
