/**
 * POST /api/v1/ai/gap-detect
 *
 * Platform-level compliance matrix gap analysis across all standards.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { QUALY_CONTEXT, ENVI_CONTEXT, SAFFY_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const ControlSchema = z.object({
  clause: z.string(),
  standard: z.string(),
  description: z.string(),
});

const AuditResultSchema = z.object({
  clause: z.string(),
  standard: z.string(),
  findingType: z.string(),
});

const Schema = z.object({
  standards: z.array(z.string()).min(1).max(3),
  existingControls: z.array(ControlSchema).max(200).optional().default([]),
  auditResults: z.array(AuditResultSchema).max(200).optional().default([]),
});

export async function gapDetect(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { standards, existingControls, auditResults } = parsed.data;

  const domainContexts = standards
    .map((s) => {
      if (s === 'iso_9001') return QUALY_CONTEXT;
      if (s === 'iso_14001') return ENVI_CONTEXT;
      if (s === 'iso_45001') return SAFFY_CONTEXT;
      return null;
    })
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = `You are the AI Sentinels compliance gap analyser.
Analyse an Integrated Management System (IMS) for gaps against Annex SL clauses 4.1-10.3.
Be thorough and specific about what is missing.

${domainContexts}`;

  const controlsText = existingControls.length > 0
    ? existingControls.map((c) => `- ${c.standard} ${c.clause}: ${c.description}`).join('\n')
    : 'No existing controls documented.';

  const auditsText = auditResults.length > 0
    ? auditResults.map((a) => `- ${a.standard} ${a.clause}: ${a.findingType}`).join('\n')
    : 'No audit results available.';

  const result = await callGemini({
    systemPrompt,
    userPrompt: `Analyse the following IMS for compliance gaps.

Standards in scope: ${standards.join(', ')}

Existing Controls:
${controlsText}

Audit Results:
${auditsText}

Analyse every Annex SL clause from 4.1 to 10.3 for each standard.
Identify gaps where there is no documented control and no conforming audit result.

Return JSON:
{
  "gaps": [
    { "clause": "4.1", "standard": "iso_9001", "severity": "high"|"medium"|"low", "description": "specific gap description" }
  ],
  "suggestions": [
    { "clause": "4.1", "standard": "iso_9001", "control": "suggested control to address the gap" }
  ],
  "coverageByStandard": {
    "iso_9001": { "covered": 0, "total": 0, "percentage": 0 }
  }
}`,
    tenantId,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  const data = JSON.parse(result.text);

  logAuditEvent({
    eventType:  'ai.gap.detected',
    entityType: 'sentinel',
    entityId:   tenantId,
    actorId:    sub,
    tenantId,
    action:     'ANALYZE',
    detail:     { standards, controlsCount: existingControls.length },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
