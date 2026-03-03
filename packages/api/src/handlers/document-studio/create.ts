import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { documents } from '@aisentinels/db/schema';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { CreateDocumentSchema, parseBody } from '../../lib/validate.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function createDocument(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(CreateDocumentSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { title, docType, content, standards, clauseRefs } = parsed.data;

  // Wrap plain text content as minimal Tiptap paragraph JSON
  const bodyJsonb: Record<string, unknown> | null = content?.trim()
    ? {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: content.trim() }],
          },
        ],
      }
    : null;

  const { client } = await getDb();

  const [doc] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .insert(documents)
      .values({
        tenantId,
        title,
        docType:    docType as typeof documents.$inferInsert['docType'],
        bodyJsonb,
        status:     'draft',
        version:    1,
        standards,
        clauseRefs,
        createdBy:  sub,  // users.id === cognitoSub (set by tenant-provision)
      })
      .returning(),
  );

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  };
}
