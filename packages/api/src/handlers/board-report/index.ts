/**
 * Board Report Lambda entry point — Phase 9-A
 *
 * Routes:
 *   POST /api/v1/board-report/generate   → generate handler (JWT)
 *   GET  /api/v1/board-report/list       → list handler (JWT)
 *   POST /api/v1/board-report/scheduled  → scheduled handler (EventBridge, no JWT)
 */
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { generate } from './generate.ts';
import { listReports } from './list.ts';
import { scheduled } from './scheduled.ts';

type HttpResponse = APIGatewayProxyStructuredResultV2;

export async function handler(
  event: APIGatewayProxyEventV2 | APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<HttpResponse> {
  const method = event.requestContext?.http?.method ?? '';
  const path = event.rawPath ?? '';

  // POST /api/v1/board-report/generate
  if (method === 'POST' && path.endsWith('/board-report/generate')) {
    return generate(event as APIGatewayProxyEventV2WithJWTAuthorizer);
  }

  // GET /api/v1/board-report/list
  if (method === 'GET' && path.endsWith('/board-report/list')) {
    return listReports(event as APIGatewayProxyEventV2WithJWTAuthorizer);
  }

  // POST /api/v1/board-report/scheduled
  if (method === 'POST' && path.endsWith('/board-report/scheduled')) {
    return scheduled(event as APIGatewayProxyEventV2);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found', path, method }),
  };
}
