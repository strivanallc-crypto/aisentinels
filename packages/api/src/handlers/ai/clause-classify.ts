/**
 * POST /api/v1/ai/clause-classify
 *
 * Doki analyses uploaded document text and identifies ISO clause references.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { callGemini } from '../../lib/gemini.ts';
import { DOKI_CLASSIFIER_CONTEXT } from '../../lib/sentinel-prompts.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';

const Schema = z.object({
  documentText: z.string().min(1).max(100_000),
  fileName: z.string().min(1).max(500),
});

export async function clauseClassify(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const { tenantId } = extractClaims(event);
  const parsed = parseBody(Schema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { documentText, fileName } = parsed.data;

  const result = await callGemini({
    systemPrompt: DOKI_CLASSIFIER_CONTEXT,
    userPrompt: `Analyse the following document and identify all ISO clause references.

File: ${fileName}

Document Content:
${documentText.slice(0, 50_000)}

Return ONLY valid JSON in this exact format:
{
  "clauses": [
    {
      "clause": "7.5",
      "standard": "iso_9001",
      "confidence": 0.95,
      "excerpt": "brief excerpt from document showing this clause reference"
    }
  ],
  "detectedType": "policy|procedure|work_instruction|form|record|manual|external",
  "detectedStandards": ["iso_9001", "iso_14001", "iso_45001"]
}`,
    tenantId,
    jsonMode: true,
    timeoutMs: 45_000,
  });

  const data = JSON.parse(result.text);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tokenUsage: result.tokenUsage }),
  };
}
