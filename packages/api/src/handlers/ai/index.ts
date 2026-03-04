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
import { documentGenerate } from './document-generate.ts';
import { clauseClassify } from './clause-classify.ts';
import { auditPlan } from './audit-plan.ts';
import { auditExamine } from './audit-examine.ts';
import { auditReport } from './audit-report.ts';
import { rootCause } from './root-cause.ts';
import { gapDetect } from './gap-detect.ts';
import { managementReview } from './management-review.ts';

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

    if (path === '/api/v1/ai/document-generate') return documentGenerate(event);
    if (path === '/api/v1/ai/clause-classify') return clauseClassify(event);
    if (path === '/api/v1/ai/audit-plan') return auditPlan(event);
    if (path === '/api/v1/ai/audit-examine') return auditExamine(event);
    if (path === '/api/v1/ai/audit-report') return auditReport(event);
    if (path === '/api/v1/ai/root-cause') return rootCause(event);
    if (path === '/api/v1/ai/gap-detect') return gapDetect(event);
    if (path === '/api/v1/ai/management-review') return managementReview(event);

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
