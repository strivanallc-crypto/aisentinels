import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { documents } from '@aisentinels/db/schema';
import { eq, and } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function submitDocument(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);

  // Path: /api/v1/document-studio/documents/{id}/submit-for-approval
  // Extract {id} — second-to-last segment
  const segments = event.rawPath.split('/');
  const id = segments.at(-2) ?? '';
  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing document id' }),
    };
  }

  const { client } = await getDb();

  // Only allow transition from 'draft' → 'review'
  const [updated] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(documents)
      .set({ status: 'review', updatedAt: new Date() })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.tenantId, tenantId),
          eq(documents.status, 'draft'),
        ),
      )
      .returning(),
  );

  if (!updated) {
    return {
      statusCode: 409,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Document not found or not in draft status' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  };
}
