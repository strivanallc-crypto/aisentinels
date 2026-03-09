import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { documents } from '@aisentinels/db/schema';
import { eq, and } from 'drizzle-orm';
import { withTenantContext } from '../../middleware/tenant-context.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

export async function decideDocument(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  // Path: /api/v1/document-studio/approvals/{approvalId}/decide
  // approvalId here is the document id (no separate approvals table in E7)
  const segments = event.rawPath.split('/');
  const approvalId = segments.at(-2) ?? '';
  if (!approvalId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing approvalId' }),
    };
  }

  let body: { decision?: string; comments?: string } = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body) as typeof body;
    } catch {
      // Ignore parse errors — validate below
    }
  }

  if (body.decision !== 'APPROVED' && body.decision !== 'REJECTED') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'decision must be APPROVED or REJECTED' }),
    };
  }

  const now = new Date();
  const isApproved = body.decision === 'APPROVED';

  const { client } = await getDb();

  const [updated] = await withTenantContext(client, tenantId, async (txDb) =>
    txDb
      .update(documents)
      .set({
        status:     isApproved ? 'approved' : 'draft',
        approvedBy: isApproved ? sub : null,
        approvedAt: isApproved ? now : null,
        updatedAt:  now,
      })
      .where(
        and(
          eq(documents.id, approvalId),
          eq(documents.tenantId, tenantId),
          eq(documents.status, 'review'),
        ),
      )
      .returning(),
  );

  if (!updated) {
    return {
      statusCode: 409,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Document not found or not under review' }),
    };
  }

  logAuditEvent({
    eventType:  isApproved ? 'document.approved' : 'document.rejected',
    entityType: 'document',
    entityId:   approvalId,
    actorId:    sub,
    tenantId,
    action:     isApproved ? 'APPROVE' : 'REJECT',
    detail:     { decision: body.decision, comments: body.comments },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  };
}
