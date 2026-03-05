import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { orgDocuments, users } from '@aisentinels/db/schema';
import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { UploadUrlSchema, parseBody } from '../../lib/validate.ts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const REGION = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const BUCKET = process.env.WORKING_FILES_BUCKET ?? `aisentinels-working-files-${REGION}`;

const s3 = new S3Client({ region: REGION });

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function uploadUrl(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const parsed = parseBody(UploadUrlSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { fileName, fileType, docCategory, relatedStandard } = parsed.data;

  const s3Key = `brain/${tenantId}/${randomUUID()}/${fileName}`;
  const { client } = await getDb();

  const [doc] = await withTenantContext(client, tenantId, async (txDb) => {
    // Look up the user's DB id from their Cognito sub (uploaded_by FK → users.id)
    const [actor] = await txDb
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.cognitoSub, sub)))
      .limit(1);

    return txDb.insert(orgDocuments).values({
      tenantId,
      fileName,
      s3Key,
      fileType,
      docCategory,
      relatedStandard: relatedStandard ?? null,
      processingStatus: 'pending',
      uploadedBy: actor?.id ?? null,
    }).returning();
  });

  // Generate presigned PUT URL (15 min expiry)
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: fileType === 'pdf' ? 'application/pdf'
      : fileType === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'text/plain',
  });
  const uploadUrlStr = await getSignedUrl(s3, command, { expiresIn: 900 });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadUrl: uploadUrlStr,
      s3Key,
      orgDocumentId: doc!.id,
    }),
  };
}
