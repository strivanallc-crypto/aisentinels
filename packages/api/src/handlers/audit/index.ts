/**
 * Audit Studio Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/audits/* routes.
 * Routes by HTTP method + rawPath to individual operation modules.
 *
 * Routes handled:
 *   GET  /api/v1/audits              → listAudits
 *   POST /api/v1/audits              → createAudit
 *   GET  /api/v1/audits/{id}         → getAudit
 *   POST /api/v1/audits/{id}/findings → addFinding
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { listAudits }  from './list.ts';
import { createAudit } from './create.ts';
import { getAudit }    from './get.ts';
import { addFinding }  from './add-finding.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // GET /api/v1/audits (exact)
    if (method === 'GET' && path === '/api/v1/audits') {
      return listAudits(event);
    }

    // POST /api/v1/audits (exact)
    if (method === 'POST' && path === '/api/v1/audits') {
      return createAudit(event);
    }

    // POST /api/v1/audits/{id}/findings
    if (method === 'POST' && path.endsWith('/findings')) {
      return addFinding(event);
    }

    // GET /api/v1/audits/{id}
    if (method === 'GET' && path.startsWith('/api/v1/audits/')) {
      return getAudit(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'AuditStudioError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
