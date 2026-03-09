/**
 * GET /api/v1/legal/status
 *
 * Returns which legal document versions the current user has accepted,
 * whether any current versions require acceptance, and which are missing.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createDb } from '@aisentinels/db';
import { extractClaims } from '../../middleware/auth-context.ts';

// Current required versions — kept in sync with frontend legal-versions.ts
const CURRENT_VERSIONS: Record<string, string> = {
  terms:   '1.0',
  privacy: '1.0',
};

// ── DB singleton ────────────────────────────────────────────────────────────

let _db: Awaited<ReturnType<typeof createDb>> | null = null;
async function getDb() {
  if (!_db) _db = await createDb({ iamAuth: true });
  return _db;
}

// ── Helper ──────────────────────────────────────────────────────────────────

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function status(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);

  const { client } = await getDb();

  const rows = await client`
    SELECT document_type, version, accepted_at
    FROM legal_acceptances
    WHERE tenant_id = ${tenantId} AND user_id = ${sub}
    ORDER BY accepted_at DESC
  `;

  const accepted = rows.map((r) => ({
    documentType: String(r.document_type),
    version:      String(r.version),
    acceptedAt:   String(r.accepted_at),
  }));

  // Check which current versions have been accepted
  const missingDocuments: string[] = [];
  for (const [docType, requiredVersion] of Object.entries(CURRENT_VERSIONS)) {
    const found = accepted.some(
      (a) => a.documentType === docType && a.version === requiredVersion,
    );
    if (!found) missingDocuments.push(docType);
  }

  return json(200, {
    accepted,
    requiresAcceptance: missingDocuments.length > 0,
    missingDocuments,
  });
}
