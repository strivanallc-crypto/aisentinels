/**
 * POST /api/v1/ai/management-review
 *
 * Platform-level management review input report per ISO 9001:9.3.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { composeSentinelPrompt, QUALY_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';

const Schema = z.object({
  auditResults: z.any().optional().default({}),
  capaStatus: z.any().optional().default({}),
  complianceScores: z.any().optional().default({}),
});

export async function managementReview(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { auditResults, capaStatus, complianceScores } = parsed.data;

  const systemPrompt = composeSentinelPrompt(
    `You are the AI Sentinels management review analyst.
Generate a management review input report per ISO 9001:2018 clause 9.3.
Structure the report for an executive audience.
Include all required inputs per ISO 9001:9.3.2.`,
    ['iso_9001'],
  );

  const result = await callGemini({
    systemPrompt,
    userPrompt: `Generate a management review input report.

Audit Results:
${JSON.stringify(auditResults, null, 2)}

CAPA Status:
${JSON.stringify(capaStatus, null, 2)}

Compliance Scores:
${JSON.stringify(complianceScores, null, 2)}

Required inputs per ISO 9001:9.3.2:
a) Status of actions from previous reviews
b) Changes in external and internal issues
c) Information on QMS performance (nonconformities, monitoring results, audit results, customer satisfaction)
d) Adequacy of resources
e) Effectiveness of risk/opportunity actions
f) Opportunities for improvement

Return JSON:
{
  "reportMarkdown": "complete management review input report in markdown",
  "recommendations": [
    { "area": "area of focus", "action": "recommended action", "priority": "high|medium|low" }
  ]
}`,
    tenantId,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  const data = JSON.parse(result.text);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
