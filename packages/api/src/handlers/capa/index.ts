/**
 * CAPA Engine Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/capa/* routes.
 * Routes by HTTP method + rawPath to individual operation modules.
 *
 * Routes handled:
 *   GET   /api/v1/capa                    → listCapas
 *   POST  /api/v1/capa                    → createCapa
 *   GET   /api/v1/capa/stats/dashboard    → capaStatsDashboard
 *   GET   /api/v1/capa/{id}               → getCapa
 *   PATCH /api/v1/capa/{id}/status        → updateCapaStatus
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { listCapas }          from './list.ts';
import { createCapa }         from './create.ts';
import { getCapa }            from './get.ts';
import { updateCapaStatus }   from './update-status.ts';
import { capaStatsDashboard } from './stats.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // GET /api/v1/capa/stats/dashboard — check BEFORE the catch-all GET /{id} branch
    if (method === 'GET' && path === '/api/v1/capa/stats/dashboard') {
      return capaStatsDashboard(event);
    }

    // GET /api/v1/capa (exact)
    if (method === 'GET' && path === '/api/v1/capa') {
      return listCapas(event);
    }

    // POST /api/v1/capa (exact)
    if (method === 'POST' && path === '/api/v1/capa') {
      return createCapa(event);
    }

    // PATCH /api/v1/capa/{id}/status — check BEFORE the GET /{id} branch
    if (method === 'PATCH' && path.endsWith('/status')) {
      return updateCapaStatus(event);
    }

    // GET /api/v1/capa/{id}
    if (method === 'GET' && path.startsWith('/api/v1/capa/')) {
      return getCapa(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'CapaEngineError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
