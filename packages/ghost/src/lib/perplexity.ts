/**
 * Perplexity API client — research engine for Ghost Sentinel.
 *
 * Uses the sonar-pro model for deep ISO compliance research.
 * API key is fetched from SSM and cached for 5 minutes.
 *
 * SSM path: /aisentinels/{env}/ghost/perplexity-api-key
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { GhostTopic, ResearchResult } from '../types/blog.ts';

// ── SSM-cached Perplexity API key ───────────────────────────────────────────

const ssm = new SSMClient({});

let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getPerplexityKey(): Promise<string> {
  if (cachedKey && Date.now() < cacheExpiry) return cachedKey;

  const envName = process.env.ENV_NAME ?? 'prod';
  const { Parameter } = await ssm.send(
    new GetParameterCommand({
      Name: `/aisentinels/${envName}/ghost/perplexity-api-key`,
      WithDecryption: true,
    }),
  );
  if (!Parameter?.Value) throw new Error('Perplexity API key not found in SSM');

  cachedKey = Parameter.Value;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedKey;
}

// ── Perplexity API Types ────────────────────────────────────────────────────

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: PerplexityChoice[];
  citations?: string[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ── Constants ───────────────────────────────────────────────────────────────

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-pro';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 45_000;

// ── Research function ───────────────────────────────────────────────────────

/**
 * Research an ISO compliance topic using Perplexity sonar-pro.
 *
 * Returns structured research results including sources, key findings,
 * and the full research text for downstream content generation.
 */
export async function researchTopic(topic: GhostTopic): Promise<ResearchResult> {
  const apiKey = await getPerplexityKey();

  const systemPrompt = `You are an expert ISO management systems researcher specialising in ISO 9001:2015 (Quality), ISO 14001:2015 (Environmental), and ISO 45001:2018 (Occupational Health & Safety).

Your task is to research the given topic thoroughly and provide:
1. Current industry trends and developments (2024-2026)
2. Relevant ISO clause references with practical implementation guidance
3. Real-world case studies or examples where possible
4. Common challenges organisations face and best practices
5. Statistical data or survey results that support key points

Always cite your sources. Be factual, authoritative, and technically precise.
Focus on actionable insights that quality managers and compliance professionals can use.`;

  const userPrompt = `Research the following topic for an in-depth blog article:

Topic: ${topic.title}
Category: ${topic.category}
Target Keywords: ${topic.targetKeywords.join(', ')}

Research Brief:
${topic.researchPrompt}

Provide comprehensive research findings covering:
- Latest developments and regulatory updates
- Key statistics and data points
- Best practices and implementation strategies
- Common pitfalls and how to avoid them
- Relevant ISO clause references

Structure your response with clear sections and cite all sources.`;

  const messages: PerplexityMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 4096,
          temperature: 0.3,
          return_citations: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as PerplexityResponse;
      const content = data.choices[0]?.message.content ?? '';
      const sources = data.citations ?? [];

      // Extract key findings (lines that start with bullets or numbered items)
      const keyFindings = content
        .split('\n')
        .filter((line) => /^\s*[-*\d+.]/.test(line))
        .map((line) => line.replace(/^\s*[-*\d+.]\s*/, '').trim())
        .filter((line) => line.length > 20)
        .slice(0, 10);

      console.log(JSON.stringify({
        event: 'PerplexityResearch',
        topicId: topic.id,
        model: MODEL,
        attempt,
        tokensUsed: data.usage.total_tokens,
        sourcesCount: sources.length,
        findingsCount: keyFindings.length,
      }));

      return {
        topic,
        perplexityResponse: content,
        sources,
        keyFindings,
        tokensUsed: data.usage.total_tokens,
        researchedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err;
      console.warn(JSON.stringify({
        event: 'PerplexityRetry',
        topicId: topic.id,
        attempt,
        error: String(err),
      }));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError;
}
