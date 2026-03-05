/**
 * Brain Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/brain/* routes.
 *
 * Routes handled:
 *   POST   /api/v1/brain/upload-url       -> uploadUrl
 *   POST   /api/v1/brain/process          -> processDocument
 *   GET    /api/v1/brain/documents        -> listBrainDocuments
 *   DELETE /api/v1/brain/documents/{id}   -> deleteBrainDocument
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { uploadUrl }           from './upload-url.ts';
import { processDocument }     from './process.ts';
import { listBrainDocuments }  from './list-documents.ts';
import { deleteBrainDocument } from './delete-document.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // POST /api/v1/brain/upload-url
    if (method === 'POST' && path === '/api/v1/brain/upload-url') {
      return uploadUrl(event);
    }

    // POST /api/v1/brain/process
    if (method === 'POST' && path === '/api/v1/brain/process') {
      return processDocument(event);
    }

    // GET /api/v1/brain/documents (exact)
    if (method === 'GET' && path === '/api/v1/brain/documents') {
      return listBrainDocuments(event);
    }

    // DELETE /api/v1/brain/documents/{id}
    if (method === 'DELETE' && path.startsWith('/api/v1/brain/documents/')) {
      return deleteBrainDocument(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'BrainError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
