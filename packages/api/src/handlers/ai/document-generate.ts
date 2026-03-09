/**
 * POST /api/v1/ai/document-generate
 *
 * Doki channels domain sentinels to write complete ISO documents.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { composeSentinelPrompt, DOKI_WRITER_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const Schema = z.object({
  documentType: z.string().min(1).max(100),
  standards: z.array(z.string()).min(1).max(3),
  orgContext: z.string().min(1).max(5000),
  sections: z.array(z.string()).min(1).max(20),
});

export async function documentGenerate(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { documentType, standards, orgContext, sections } = parsed.data;

  const systemPrompt = composeSentinelPrompt(DOKI_WRITER_CONTEXT, standards);
  const userPrompt = `Write a complete ${documentType} for the following organisation.

Organisation Context:
${orgContext}

Document must cover these sections:
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Standards to address: ${standards.join(', ')}

Requirements:
- Write complete, professional content for EVERY section (not outlines or placeholders)
- Include specific [ISO XXXX:X.X] clause citations inline where relevant
- Tailor content to the organisation's context, industry, and scope
- Use proper document structure with numbered headings

Return JSON: { "content": "full document markdown", "clauseRefs": ["ISO 9001:7.5", ...], "confidence": 0.0-1.0 }`;

  const result = await callGemini({
    systemPrompt,
    userPrompt,
    tenantId,
    jsonMode: true,
    timeoutMs: 60_000,
  });

  const data = JSON.parse(result.text);

  logAuditEvent({
    eventType:  'ai.document.generated',
    entityType: 'sentinel',
    entityId:   tenantId,
    actorId:    sub,
    tenantId,
    action:     'GENERATE',
    detail:     { documentType, standards, sections },
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
