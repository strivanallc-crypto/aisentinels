/**
 * Compliance Lambda — Phase 13B entry point dispatcher.
 *
 * Handles both API Gateway requests and EventBridge scheduled invocations.
 *
 * API Routes (JWT + admin role required):
 *   POST /api/v1/admin/compliance/run-checks → trigger checks manually
 *   GET  /api/v1/admin/compliance/results    → query check results
 *
 * EventBridge:
 *   Weekly schedule → run all checks automatically
 *
 * Internal only — never exposed to tenants.
 */
import type {
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { extractClaims } from '../../middleware/auth-context.ts';
import { runComplianceChecks } from './internal-checks.ts';

// ── DynamoDB client (singleton) ──────────────────────────────────────────────
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.COMPLIANCE_CHECKS_TABLE ?? '';

const json = (statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── POST /api/v1/admin/compliance/run-checks ─────────────────────────────────

async function handleRunChecks(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const claims = extractClaims(event);
  if (claims.role !== 'admin') {
    return json(403, { error: 'Forbidden — admin role required' });
  }

  // Fire-and-forget — don't block the response
  void runComplianceChecks().catch((err: unknown) => {
    console.error(JSON.stringify({
      event: 'ComplianceRunChecksError',
      error: err instanceof Error ? err.message : String(err),
    }));
  });

  return json(200, { triggered: true, timestamp: new Date().toISOString() });
}

// ── GET /api/v1/admin/compliance/results ─────────────────────────────────────

async function handleGetResults(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const claims = extractClaims(event);
  if (claims.role !== 'admin') {
    return json(403, { error: 'Forbidden — admin role required' });
  }

  const checkIdFilter = event.queryStringParameters?.checkId;
  const checkIds = checkIdFilter
    ? [checkIdFilter]
    : ['iam-key-age', 's3-encryption', 'cloudtrail-status'];

  const allResults: Record<string, unknown>[] = [];

  for (const checkId of checkIds) {
    const resp = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'checkId = :cid',
      ExpressionAttributeValues: { ':cid': checkId },
      Limit: 10,
      ScanIndexForward: false, // newest first
    }));
    allResults.push(...(resp.Items ?? []));
  }

  return json(200, { results: allResults });
}

// ── Lambda handler (API Gateway + EventBridge) ───────────────────────────────

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  // EventBridge scheduled invocation — no requestContext.http
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isScheduledEvent = !(event as any).requestContext?.http;

  if (isScheduledEvent) {
    console.log(JSON.stringify({ event: 'ComplianceScheduledRun', source: 'eventbridge' }));
    await runComplianceChecks();
    return json(200, { scheduled: true, timestamp: new Date().toISOString() });
  }

  // API Gateway request
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method === 'POST' && path === '/api/v1/admin/compliance/run-checks') {
      return handleRunChecks(event);
    }

    if (method === 'GET' && path === '/api/v1/admin/compliance/results') {
      return handleGetResults(event);
    }

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error(JSON.stringify({ event: 'ComplianceHandlerError', error: String(err), method, path }));
    return json(500, { error: message });
  }
};
