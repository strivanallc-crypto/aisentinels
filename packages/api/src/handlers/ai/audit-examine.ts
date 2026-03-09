/**
 * POST /api/v1/ai/audit-examine
 *
 * Audie conducts clause-by-clause examination per ISO 19011:6.4.
 * Channels the relevant domain sentinel for standard-specific knowledge.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { composeSentinelPrompt, AUDIE_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const ConversationMessage = z.object({
  role: z.enum(['auditor', 'auditee']),
  content: z.string(),
});

const Schema = z.object({
  clause: z.string().min(1).max(20),
  standard: z.string().min(1).max(20),
  auditContext: z.string().min(1).max(5000),
  evidence: z.array(z.string()).max(20).optional().default([]),
  conversationHistory: z.array(ConversationMessage).max(50).optional().default([]),
});

export async function auditExamine(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { sub, tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { clause, standard, auditContext, evidence, conversationHistory } = parsed.data;

  const systemPrompt = composeSentinelPrompt(AUDIE_CONTEXT, [standard]) + `

CRITICAL INSTRUCTIONS:
- You are examining clause ${clause} of ${standard}
- Ask for OBJECTIVE EVIDENCE. Do not accept vague answers.
- Be professional, thorough, and impartial per ISO 19011:6.4
- When you have sufficient evidence, classify conformity and set findingType
- Do NOT be friendly or chatty. Be a professional auditor.
- Each response should either request specific evidence OR classify a finding`;

  const history = conversationHistory
    .map((m) => `${m.role === 'auditor' ? 'Auditor (Audie)' : 'Auditee'}: ${m.content}`)
    .join('\n\n');

  const evidenceList = evidence.length > 0
    ? `\nEvidence provided: ${evidence.join(', ')}`
    : '';

  const userPrompt = `Audit Context: ${auditContext}
Clause under examination: ${standard} clause ${clause}
${evidenceList}

${history ? `Conversation history:\n${history}\n\nContinue the audit examination.` : 'Begin the audit examination of this clause. Ask your first question requesting specific objective evidence.'}

Return JSON:
{
  "response": "your auditor response text",
  "findingType": null | "major_nc" | "minor_nc" | "observation" | "opportunity",
  "clauseRef": "${clause}",
  "evidenceRequested": ["specific document or record you want to see next"]
}

Set findingType to null if you need more evidence. Only set it when you have enough to classify.`;

  const result = await callGemini({
    systemPrompt,
    userPrompt,
    tenantId,
    jsonMode: true,
    timeoutMs: 30_000,
  });

  const data = JSON.parse(result.text);

  logAuditEvent({
    eventType:  'ai.audit.examined',
    entityType: 'sentinel',
    entityId:   `${standard}:${clause}`,
    actorId:    sub,
    tenantId,
    action:     'EXAMINE',
    detail:     { clause, standard },
    clauseRef:  clause,
    standard,
    severity:   'info',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
