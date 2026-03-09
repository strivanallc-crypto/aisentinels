/**
 * JWT claim extractor for API Gateway v2 JWT authorizer events.
 *
 * The JWT authorizer rejects unauthenticated requests before this runs.
 * This function validates that all required claims are present and returns
 * them as a typed AuthClaims object.
 *
 * Claims are injected by the pre-token-generation trigger:
 *   email    ← email           (standard Cognito attribute)
 *   tenantId ← custom:tenantId (set by post-confirmation trigger)
 *   role     ← custom:role     (set by post-confirmation trigger)
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export interface AuthClaims {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
}

export function extractClaims(event: APIGatewayProxyEventV2WithJWTAuthorizer): AuthClaims {
  const rawClaims = event.requestContext.authorizer.jwt.claims;

  // Claims are typed as string | number | boolean | string[] — convert to string
  const sub = String(rawClaims['sub'] ?? '');
  const tenantId = String(rawClaims['tenantId'] ?? '');
  const role = String(rawClaims['role'] ?? '');

  // email: prefer the injected claim, fall back to cognito:username or sub
  // (backward-compatible with tokens issued before the email injection fix)
  let email = String(rawClaims['email'] ?? '');
  if (!email) {
    email = String(rawClaims['cognito:username'] ?? rawClaims['username'] ?? sub);
    console.warn(`JWT missing email claim — falling back to: ${email}`);
  }

  if (!sub) throw new Error('Missing JWT claim: sub');
  if (!tenantId) throw new Error('Missing JWT claim: tenantId');
  if (!role) throw new Error('Missing JWT claim: role');

  return { sub, email, tenantId, role };
}
