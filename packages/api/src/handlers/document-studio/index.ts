/**
 * Document Studio Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/document-studio/* routes.
 * Routes by HTTP method + rawPath to individual operation modules.
 *
 * Routes handled:
 *   GET   /api/v1/document-studio/documents                       → listDocuments
 *   POST  /api/v1/document-studio/documents                       → createDocument
 *   GET   /api/v1/document-studio/documents/{id}                  → getDocument
 *   PATCH /api/v1/document-studio/documents/{id}                  → updateDocument
 *   POST  /api/v1/document-studio/documents/{id}/submit-for-approval → submitDocument
 *   POST  /api/v1/document-studio/approvals/{approvalId}/decide   → decideDocument
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { listDocuments } from './list.ts';
import { createDocument } from './create.ts';
import { getDocument } from './get.ts';
import { updateDocument } from './update.ts';
import { submitDocument } from './submit.ts';
import { decideDocument } from './decide.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // GET /api/v1/document-studio/documents (exact)
    if (method === 'GET' && path === '/api/v1/document-studio/documents') {
      return listDocuments(event);
    }

    // POST /api/v1/document-studio/documents (exact)
    if (method === 'POST' && path === '/api/v1/document-studio/documents') {
      return createDocument(event);
    }

    // POST /api/v1/document-studio/documents/{id}/submit-for-approval
    if (method === 'POST' && path.endsWith('/submit-for-approval')) {
      return submitDocument(event);
    }

    // POST /api/v1/document-studio/approvals/{approvalId}/decide
    if (method === 'POST' && path.includes('/approvals/') && path.endsWith('/decide')) {
      return decideDocument(event);
    }

    // PATCH /api/v1/document-studio/documents/{id} (update document)
    if (method === 'PATCH' && path.startsWith('/api/v1/document-studio/documents/')) {
      return updateDocument(event);
    }

    // GET /api/v1/document-studio/documents/{id}
    if (method === 'GET' && path.startsWith('/api/v1/document-studio/documents/')) {
      return getDocument(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'DocumentStudioError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
