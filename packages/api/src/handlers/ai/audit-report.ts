/**
 * POST /api/v1/ai/audit-report
 *
 * Audie generates a formal audit report per ISO 19011:6.5.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { composeSentinelPrompt, AUDIE_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const FindingSchema = z.object({
  clause: z.string(),
  standard: z.string(),
  type: z.enum(['major_nc', 'minor_nc', 'observation', 'opportunity', 'conforming']),
  description: z.string(),
  evidence: z.array(z.string()).optional().default([]),
});

const Schema = z.object({
  sessionId: z.string().min(1),
  findings: z.array(FindingSchema).max(100),
  scope: z.string().min(1).max(5000),
  standards: z.array(z.string()).min(1).max(3),
  auditDate: z.string().min(1),
});

export async function auditReport(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { sessionId, findings, scope, standards, auditDate } = parsed.data;

  const systemPrompt = composeSentinelPrompt(AUDIE_CONTEXT, standards);

  const findingsText = findings
    .map((f, i) => `${i + 1}. [${f.type.toUpperCase()}] ${f.standard} clause ${f.clause}: ${f.description}`)
    .join('\n');

  const result = await callGemini({
    systemPrompt,
    userPrompt: `Generate a formal audit report per ISO 19011:2018 clause 6.5.

Audit Date: ${auditDate}
Standards: ${standards.join(', ')}
Scope: ${scope}
Total Findings: ${findings.length}

Findings:
${findingsText}

Report structure (per ISO 19011:6.5):
1. Executive Summary
2. Audit Scope & Criteria
3. Methodology (how the audit was conducted)
4. Findings Detail:
   a. Major Non-Conformities
   b. Minor Non-Conformities
   c. Observations
   d. Opportunities for Improvement
5. Conclusion
6. Recommendations & Next Steps

Return JSON:
{
  "reportMarkdown": "complete formal report in markdown",
  "findingSummary": { "major_nc": 0, "minor_nc": 0, "observation": 0, "opportunity": 0, "conforming": 0 },
  "conclusion": "brief overall conclusion statement"
}`,
    tenantId,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  const data = JSON.parse(result.text);

  logAuditEvent({
    eventType:  'ai.audit.reported',
    entityType: 'sentinel',
    entityId:   sessionId,
    actorId:    sub,
    tenantId,
    action:     'GENERATE',
    detail:     { standards, findingsCount: findings.length, auditDate },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
