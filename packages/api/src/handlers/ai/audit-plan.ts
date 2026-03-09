/**
 * POST /api/v1/ai/audit-plan
 *
 * Audie generates a formal audit plan per ISO 19011:6.3.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { composeSentinelPrompt, AUDIE_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const Schema = z.object({
  standards: z.array(z.string()).min(1).max(3),
  scope: z.string().min(1).max(5000),
  auditType: z.string().min(1).max(100),
  orgContext: z.string().min(1).max(5000),
});

export async function auditPlan(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { standards, scope, auditType, orgContext } = parsed.data;

  const systemPrompt = composeSentinelPrompt(AUDIE_CONTEXT, standards);

  const result = await callGemini({
    systemPrompt,
    userPrompt: `Generate a formal audit plan per ISO 19011:2018 clause 6.3.

Audit Type: ${auditType}
Standards: ${standards.join(', ')}
Scope: ${scope}
Organisation Context: ${orgContext}

The audit plan must include:
1. Audit objectives and criteria
2. Audit scope (processes, locations, timeframe)
3. Clause sampling strategy (which clauses to examine and why)
4. Evidence requirements per clause
5. Schedule with estimated time per clause/process area
6. Audit team roles (even if single auditor)
7. Resources and logistics

Return JSON:
{
  "plan": "complete audit plan in markdown",
  "clauseChecklist": ["4.1", "4.2", "5.1", ...],
  "evidenceRequirements": ["Quality policy document", "Management review minutes", ...]
}`,
    tenantId,
    jsonMode: true,
    timeoutMs: 45_000,
  });

  const data = JSON.parse(result.text);

  logAuditEvent({
    eventType:  'ai.audit.planned',
    entityType: 'sentinel',
    entityId:   tenantId,
    actorId:    sub,
    tenantId,
    action:     'PLAN',
    detail:     { auditType, standards, scope: scope.slice(0, 200) },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
