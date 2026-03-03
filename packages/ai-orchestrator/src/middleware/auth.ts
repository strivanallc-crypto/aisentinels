/**
 * JWT claims extraction.
 *
 * API Gateway JWT authorizer validates the Cognito access token and rejects
 * unauthenticated requests before they reach the ALB. The Fargate service
 * decodes claims from the forwarded Authorization header — no re-validation needed
 * in E5. Defense-in-depth full re-validation can be added in a hardening epic.
 */

export interface AuthClaims {
  /** Cognito user ID — matches cognitoSub in the users table */
  sub: string;
  /** Tenant UUID — injected by pre-token-generation Lambda trigger */
  tenantId: string;
  /** User role — injected by pre-token-generation Lambda trigger */
  role: string;
}

/**
 * Extracts and validates required JWT claims from the Authorization header.
 * Throws if the header is missing, malformed, or required claims are absent.
 */
export function extractClaims(authHeader: string | undefined): AuthClaims {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const parts = authHeader.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: expected 3 parts');
  }

  const payload = parts[1];
  if (!payload) {
    throw new Error('Malformed JWT: empty payload');
  }

  let decoded: Record<string, unknown>;
  try {
    decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    ) as Record<string, unknown>;
  } catch {
    throw new Error('Malformed JWT: payload is not valid JSON');
  }

  const tenantId = String(decoded['tenantId'] ?? '');
  const role = String(decoded['role'] ?? '');
  const sub = String(decoded['sub'] ?? '');

  if (!tenantId || !role || !sub) {
    throw new Error('Missing required JWT claims: tenantId, role, or sub');
  }

  return { tenantId, role, sub };
}
