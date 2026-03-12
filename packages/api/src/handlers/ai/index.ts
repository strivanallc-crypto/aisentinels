/**
 * AI Sentinel Lambda handler — dispatches all /api/v1/ai/* routes.
 *
 * Supports two invocation sources:
 *   1. API Gateway v2 (JWT authorizer) — claims pre-validated at gateway level
 *   2. Lambda Function URL (authType: NONE) — JWT decoded from Authorization header
 *
 * The Function URL path bypasses API Gateway's hard 30s integration timeout,
 * allowing Gemini 2.5 Pro calls that take 30-90s to complete successfully.
 *
 * 8 endpoints:
 *   POST /api/v1/ai/document-generate  — Doki writes documents
 *   POST /api/v1/ai/clause-classify    — Doki classifies uploaded docs
 *   POST /api/v1/ai/audit-plan         — Audie generates audit plan
 *   POST /api/v1/ai/audit-examine      — Audie clause examination
 *   POST /api/v1/ai/audit-report       — Audie formal report
 *   POST /api/v1/ai/root-cause         — Nexus guides RCA
 *   POST /api/v1/ai/gap-detect         — Platform gap analysis
 *   POST /api/v1/ai/management-review  — Platform management review
 */
import type {
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithJWTAuthorizer,
} from 'aws-lambda';
import { withCreditCheck } from '../../middleware/check-ai-credits.ts';
import { documentGenerate } from './document-generate.ts';
import { clauseClassify } from './clause-classify.ts';
import { auditPlan } from './audit-plan.ts';
import { auditExamine } from './audit-examine.ts';
import { auditReport } from './audit-report.ts';
import { rootCause } from './root-cause.ts';
import { gapDetect } from './gap-detect.ts';
import { managementReview } from './management-review.ts';

// Wrap all AI handlers with credit deduction
const metered = {
  documentGenerate: withCreditCheck(documentGenerate),
  clauseClassify:   withCreditCheck(clauseClassify),
  auditPlan:        withCreditCheck(auditPlan),
  auditExamine:     withCreditCheck(auditExamine),
  auditReport:      withCreditCheck(auditReport),
  rootCause:        withCreditCheck(rootCause),
  gapDetect:        withCreditCheck(gapDetect),
  managementReview: withCreditCheck(managementReview),
};

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * Normalise incoming event for both API Gateway (JWT authorizer) and
 * Lambda Function URL (raw Authorization header).
 *
 * API Gateway injects decoded claims at event.requestContext.authorizer.jwt.claims.
 * Function URL doesn't — this function decodes the JWT from the Authorization
 * header and injects claims into that same location so downstream
 * extractClaims() works unchanged.
 */
function normaliseEvent(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  // API Gateway path — claims already injected by JWT authorizer
  if (event.requestContext?.authorizer?.jwt?.claims) {
    return event;
  }

  // Function URL path — decode JWT from Authorization header
  const authHeader =
    (event.headers as Record<string, string | undefined>)?.authorization ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw Object.assign(new Error('Missing Authorization header'), { statusCode: 401 });
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Malformed JWT'), { statusCode: 401 });
  }

  const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());

  // Inject claims into the structure expected by extractClaims()
  const evt = event as unknown as Record<string, unknown>;
  const rc = (evt.requestContext ?? {}) as Record<string, unknown>;
  rc.authorizer = {
    jwt: {
      claims: {
        sub: payload.sub ?? '',
        email: payload.email ?? '',
        tenantId: payload.tenantId ?? payload['custom:tenantId'] ?? '',
        role: payload.role ?? payload['custom:role'] ?? 'member',
      },
    },
  };
  evt.requestContext = rc;

  return event;
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method !== 'POST') {
      return json(405, { error: `Method not allowed: ${method}` });
    }

    // Normalise event so extractClaims() works for both API GW and Function URL
    const evt = normaliseEvent(event);

    if (path === '/api/v1/ai/document-generate') return metered.documentGenerate(evt);
    if (path === '/api/v1/ai/clause-classify') return metered.clauseClassify(evt);
    if (path === '/api/v1/ai/audit-plan') return metered.auditPlan(evt);
    if (path === '/api/v1/ai/audit-examine') return metered.auditExamine(evt);
    if (path === '/api/v1/ai/audit-report') return metered.auditReport(evt);
    if (path === '/api/v1/ai/root-cause') return metered.rootCause(evt);
    if (path === '/api/v1/ai/gap-detect') return metered.gapDetect(evt);
    if (path === '/api/v1/ai/management-review') return metered.managementReview(evt);

    return json(404, { error: `Not found: ${method} ${path}` });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    const message = err instanceof Error ? err.message : 'Internal server error';

    console.error(JSON.stringify({
      event: 'AiHandlerError',
      error: String(err),
      method,
      path,
      statusCode,
    }));

    return json(statusCode, { error: message });
  }
};
