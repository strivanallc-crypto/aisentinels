/**
 * POST /api/v1/legal/accept
 *
 * Records the user's acceptance of a legal document (terms, privacy, eula).
 * Idempotent — duplicate acceptance for same doc+version is a no-op.
 * Logs to audit trail for ISO 15489 compliance.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { sendEmail, FROM_LEGAL } from '../../lib/mailer.ts';
import { legalConfirmationTemplate } from '../../lib/email-templates.ts';

// ── DB singleton ────────────────────────────────────────────────────────────

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Validation ──────────────────────────────────────────────────────────────

const AcceptSchema = z.object({
  documentType: z.enum(['terms', 'privacy', 'eula']),
  version: z.string().min(1).max(10),
});

// ── Helper ──────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function accept(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, email, tenantId } = extractClaims(event);

  const parsed = parseBody(AcceptSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { documentType, version } = parsed.data;

  // Extract client metadata
  const headers = event.headers ?? {};
  const ipAddress =
    headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    headers['x-real-ip'] ??
    null;
  const userAgent = headers['user-agent'] ?? null;

  const { client } = await getDb();

  // Idempotent upsert — ON CONFLICT DO NOTHING
  const rows = await client`
    INSERT INTO legal_acceptances (tenant_id, user_id, document_type, version, ip_address, user_agent)
    VALUES (${tenantId}, ${sub}, ${documentType}, ${version}, ${ipAddress}, ${userAgent})
    ON CONFLICT (tenant_id, user_id, document_type, version) DO NOTHING
    RETURNING accepted_at
  `;

  const acceptedAt = rows.length > 0
    ? (rows[0] as { accepted_at: string }).accepted_at
    : new Date().toISOString();

  // Fire-and-forget audit log
  logAuditEvent({
    eventType:  'legal.accepted',
    entityType: 'legal',
    entityId:   `${documentType}-v${version}`,
    actorId:    sub,
    actorEmail: email,
    tenantId,
    action:     'ACCEPT',
    detail:     { documentType, version, ipAddress },
    ipAddress:  ipAddress ?? undefined,
    userAgent:  userAgent ?? undefined,
    severity:   'info',
  });

  // Fire-and-forget: legal acceptance confirmation email
  // Only send for new acceptances (rows.length > 0), not duplicate no-ops
  if (rows.length > 0) {
    const emailData = legalConfirmationTemplate({
      userEmail: email,
      orgName: tenantId, // org name unavailable here, tenantId as fallback
      acceptedAt: String(acceptedAt),
      ipAddress: ipAddress ?? 'unknown',
    });
    sendEmail({ ...emailData, to: email, from: FROM_LEGAL, replyTo: 'legal@aisentinels.io' });
  }

  return json(200, {
    accepted: true,
    documentType,
    version,
    acceptedAt,
  });
}
