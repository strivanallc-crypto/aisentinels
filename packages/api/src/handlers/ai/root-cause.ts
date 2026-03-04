/**
 * POST /api/v1/ai/root-cause
 *
 * Nexus guides root cause analysis ONE QUESTION AT A TIME.
 * Channels the relevant domain sentinel for standard-specific context.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { composeSentinelPrompt, NEXUS_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';

const HistoryMessage = z.object({
  role: z.enum(['nexus', 'user']),
  content: z.string(),
});

const Schema = z.object({
  findingDescription: z.string().min(1).max(5000),
  clauseRef: z.string().min(1).max(100),
  standard: z.string().min(1).max(20),
  method: z.enum(['5why', 'fishbone', '8d']),
  history: z.array(HistoryMessage).max(50).optional().default([]),
});

const METHOD_INSTRUCTIONS: Record<string, string> = {
  '5why': `Guide a 5-Why analysis. Ask ONE "Why?" question at a time based on the previous answer.
Track which "Why" number you are on (1st Why, 2nd Why, etc.).
After approximately 5 iterations (or when the true root cause is reached), identify the root cause.`,
  'fishbone': `Guide an Ishikawa/Fishbone analysis. Examine ONE category at a time:
Man (People), Machine (Equipment), Method (Process), Material, Measurement, Environment.
Ask focused questions about each category to identify contributing causes.`,
  '8d': `Guide an 8D problem-solving process. Work through ONE discipline at a time:
D1: Team, D2: Problem Description, D3: Containment, D4: Root Cause,
D5: Corrective Actions, D6: Implementation, D7: Prevention, D8: Congratulations.`,
};

export async function rootCause(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { findingDescription, clauseRef, standard, method, history } = parsed.data;

  const systemPrompt = composeSentinelPrompt(NEXUS_CONTEXT, [standard]) + `

RCA METHOD: ${method.toUpperCase()}
${METHOD_INSTRUCTIONS[method]}

CRITICAL: Ask ONE question at a time. Do NOT jump to conclusions.
Build understanding step by step. Be methodical and thorough.`;

  const historyText = history
    .map((m) => `${m.role === 'nexus' ? 'Nexus' : 'User'}: ${m.content}`)
    .join('\n\n');

  const userPrompt = `Finding: ${findingDescription}
Clause Reference: ${standard} clause ${clauseRef}
Method: ${method}

${historyText ? `Analysis history:\n${historyText}\n\nContinue the analysis. Ask your next question.` : 'Begin the root cause analysis. Ask your first question.'}

Return JSON:
{
  "response": "your question or analysis text",
  "rootCause": null | "identified root cause statement (only when analysis is complete)",
  "actions": null | [{"type": "corrective"|"preventive", "description": "specific action", "priority": "high"|"medium"|"low"}],
  "isComplete": false | true
}

Set isComplete=true and rootCause only when the root cause has been truly identified through the analysis process.`;

  const result = await callGemini({
    systemPrompt,
    userPrompt,
    tenantId,
    jsonMode: true,
    timeoutMs: 30_000,
  });

  const data = JSON.parse(result.text);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
