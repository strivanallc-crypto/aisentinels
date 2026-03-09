/**
 * Bulk Upload Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/bulk-upload/* routes.
 * Routes by HTTP method + rawPath to individual operation modules.
 *
 * Routes handled:
 *   POST /api/v1/bulk-upload/initiate          → initiate (create batch + presigned URLs)
 *   POST /api/v1/bulk-upload/process           → processBatch (process uploaded files)
 *   GET  /api/v1/bulk-upload/batch/{batchId}   → batchStatus (poll batch progress)
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { initiate } from './initiate.ts';
import { processBatch } from './process.ts';
import { batchStatus } from './status.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    // POST /api/v1/bulk-upload/initiate
    if (method === 'POST' && path === '/api/v1/bulk-upload/initiate') {
      return initiate(event);
    }

    // POST /api/v1/bulk-upload/process
    if (method === 'POST' && path === '/api/v1/bulk-upload/process') {
      return processBatch(event);
    }

    // GET /api/v1/bulk-upload/batch/{batchId}
    if (method === 'GET' && path.startsWith('/api/v1/bulk-upload/batch/')) {
      return batchStatus(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'BulkUploadError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
