/**
 * Records Vault Lambda â€” entry point dispatcher.
 *
 * Handles all /api/v1/records-vault/* routes.
 * Routes by HTTP method + rawPath to individual operation modules.
 *
 * Routes handled:
 *   GET  /api/v1/records-vault/records                        â†’ listRecords
 *   POST /api/v1/records-vault/records                        â†’ createRecord
 *   POST /api/v1/records-vault/records/{id}/verify-integrity  â†’ verifyIntegrity
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { listRecords }      from './list.ts';
import { createRecord }     from './create.ts';
import { verifyIntegrity }  from './verify-integrity.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // GET /api/v1/records-vault/records (exact)
    if (method === 'GET' && path === '/api/v1/records-vault/records') {
      return listRecords(event);
    }

    // POST /api/v1/records-vault/records (exact)
    if (method === 'POST' && path === '/api/v1/records-vault/records') {
      return createRecord(event);
    }

    // POST /api/v1/records-vault/records/{id}/verify-integrity
    // Regex ensures a non-empty {id} segment exists before the suffix
    if (method === 'POST' && /\/records-vault\/records\/[^/]+\/verify-integrity$/.test(path)) {
      return verifyIntegrity(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'RecordsVaultError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
