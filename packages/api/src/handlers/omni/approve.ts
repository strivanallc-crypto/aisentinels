/**
 * POST /api/v1/omni/approve
 *
 * Email-link approval handler — approve/reject documents without app login.
 * Auth: approval token in body (NOT Cognito JWT — token IS the auth).
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { verifyApprovalToken } from '../../lib/approval-token.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { sendOmniMessage } from '../../lib/omni-mailer.ts';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function approve(event: APIGatewayProxyEventV2) {
  // ── Parse body ─────────────────────────────────────────────────────────
  let body: { token?: string; decision?: string; comment?: string };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { token, decision, comment } = body;

  if (!token || typeof token !== 'string') {
    return json(400, { error: 'Missing required field: token' });
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return json(400, { error: 'Decision must be "approve" or "reject"' });
  }

  // ── Verify token ───────────────────────────────────────────────────────
  const payload = await verifyApprovalToken(token);
  if (!payload) {
    return json(401, { error: 'Token expired or invalid' });
  }

  const { documentId, approverId, tenantId } = payload;

  // ── Process decision ───────────────────────────────────────────────────
  // In a full implementation, this would call the document decide handler
  // to persist the approval/rejection in the database. For now, we log
  // the decision and send a confirmation email.
  //
  // TODO: Call document-studio decide handler logic:
  //   await documentDecide({ documentId, decision, approverId, tenantId, comment });

  // ── Audit trail ────────────────────────────────────────────────────────
  const eventType = decision === 'approve' ? 'document.approved' : 'document.rejected';

  logAuditEvent({
    eventType,
    entityType: 'document',
    entityId: documentId,
    actorId: approverId,
    tenantId,
    action: decision === 'approve' ? 'APPROVE' : 'REJECT',
    detail: {
      documentId,
      decision,
      comment: comment ?? null,
      source: 'email-approval-token',
    },
    severity: decision === 'approve' ? 'info' : 'warning',
  });

  // ── Confirmation email — fire-and-forget ───────────────────────────────
  const decisionText = decision === 'approve' ? 'approved' : 'rejected';

  sendOmniMessage({
    toEmail: '', // TODO: resolve approver email from Cognito sub
    subject: `Document ${decisionText} — Confirmation`,
    bodyHtml: `
      <p>Your decision has been recorded:</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;font-weight:600;">Decision: ${decisionText.charAt(0).toUpperCase() + decisionText.slice(1)}</p>
        <p style="margin:0;color:#71717a;font-size:12px;">Document ID: ${documentId}</p>
        ${comment ? `<p style="margin:4px 0 0;color:#71717a;font-size:12px;">Comment: ${comment}</p>` : ''}
      </div>
      <p>Thank you for your prompt review.</p>
    `,
    tenantId,
  }).catch(() => { /* fire-and-forget */ });

  // ── Response ───────────────────────────────────────────────────────────
  return json(200, {
    success: true,
    documentId,
    decision,
  });
}
