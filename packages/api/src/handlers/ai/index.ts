/**
 * AI Sentinel Lambda handler — dispatches all /api/v1/ai/* routes.
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
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
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

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  try {
    if (method !== 'POST') {
      return json(405, { error: `Method not allowed: ${method}` });
    }

    if (path === '/api/v1/ai/document-generate') return metered.documentGenerate(event);
    if (path === '/api/v1/ai/clause-classify') return metered.clauseClassify(event);
    if (path === '/api/v1/ai/audit-plan') return metered.auditPlan(event);
    if (path === '/api/v1/ai/audit-examine') return metered.auditExamine(event);
    if (path === '/api/v1/ai/audit-report') return metered.auditReport(event);
    if (path === '/api/v1/ai/root-cause') return metered.rootCause(event);
    if (path === '/api/v1/ai/gap-detect') return metered.gapDetect(event);
    if (path === '/api/v1/ai/management-review') return metered.managementReview(event);

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
