/**
 * Content Generator — Claude-powered blog content creation for Ghost Sentinel.
 *
 * Uses Claude Sonnet to transform Perplexity research into polished,
 * SEO-optimised long-form blog articles.
 *
 * API key: reuses existing SSM path /aisentinels/{env}/ai/anthropic-api-key
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import Anthropic from '@anthropic-ai/sdk';
import type { ResearchResult, GeneratedContent } from '../types/blog.ts';

// ── SSM-cached Anthropic API key ────────────────────────────────────────────

const ssm = new SSMClient({});

let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getAnthropicApiKey(): Promise<string> {
  if (cachedKey && Date.now() < cacheExpiry) return cachedKey;

  const envName = process.env.ENV_NAME ?? 'prod';
  const { Parameter } = await ssm.send(
    new GetParameterCommand({
      Name: `/aisentinels/${envName}/ai/anthropic-api-key`,
      WithDecryption: true,
    }),
  );
  if (!Parameter?.Value) throw new Error('Anthropic API key not found in SSM');

  cachedKey = Parameter.Value;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedKey;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 120_000; // 2 minutes — long-form content takes time

// ── Ghost Persona System Prompt ─────────────────────────────────────────────

const GHOST_SYSTEM_PROMPT = `You are Ghost, Sentinel 7 of the AI Sentinels platform — the autonomous ISO SEO Content Engine.

IDENTITY
You write authoritative, engaging, SEO-optimised blog articles about ISO management systems (9001, 14001, 45001) and compliance technology. You are the voice of aisentinels.io — professional, technically precise, yet approachable for quality managers, compliance officers, and leadership teams.

WRITING STYLE
- Authoritative but conversational — not academic, not salesy
- Use ISO terminology correctly: conformity, nonconformity, corrective action, documented information, risk-based thinking, process approach
- Always cite relevant ISO clause references [ISO XXXX:YYYY §X.X]
- Include practical, actionable advice — readers should walk away with clear next steps
- Use data points and statistics from the research to support claims
- Break up content with clear headings (H2, H3), bullet lists, and callout boxes
- Target 1,500–2,500 words for comprehensive coverage
- Write in British English (organisation, standardise, etc.)

SEO REQUIREMENTS
- Include target keywords naturally throughout the content (2–3% density)
- Write a compelling meta title (50–60 characters) — different from the article title
- Write a meta description (150–160 characters) that drives clicks
- Front-load important keywords in headings
- Include an excerpt (2–3 sentences) for article cards and social sharing
- Suggest 4–6 relevant tags
- Generate 3–5 FAQ items based on "People Also Ask" patterns for the topic

OUTPUT FORMAT
Return ONLY valid JSON (no markdown fences) with this schema:
{
  "title": "Compelling article title (H1) — 60–80 characters",
  "metaTitle": "SEO meta title — 50–60 characters",
  "metaDescription": "Click-driving meta description — 150–160 characters",
  "excerpt": "2–3 sentence excerpt for article cards",
  "content": "Full article in Markdown format with ## and ### headings",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "faqItems": [
    { "question": "FAQ question?", "answer": "Concise answer (2–3 sentences)." }
  ],
  "wordCount": 2000,
  "readingTimeMinutes": 8
}`;

// ── Content generation function ─────────────────────────────────────────────

/**
 * Generate a complete blog article from Perplexity research results.
 *
 * Returns structured content ready for storage and publishing.
 */
export async function generateBlogPost(research: ResearchResult): Promise<{
  generated: GeneratedContent;
  tokensUsed: number;
}> {
  const apiKey = await getAnthropicApiKey();
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const userPrompt = `Write a comprehensive blog article based on this research:

TOPIC: ${research.topic.title}
CATEGORY: ${research.topic.category}
TARGET KEYWORDS: ${research.topic.targetKeywords.join(', ')}
CONTENT BRIEF: ${research.topic.contentBrief}

RESEARCH FINDINGS:
${research.perplexityResponse}

SOURCES:
${research.sources.map((s, i) => `[${i + 1}] ${s}`).join('\n')}

KEY FINDINGS:
${research.keyFindings.map((f) => `- ${f}`).join('\n')}

Write the article following the SEO and style requirements. Return ONLY valid JSON.`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await Promise.race([
        client.messages.create({
          model: MODEL,
          max_tokens: 8192,
          system: GHOST_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Claude timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
        ),
      ]);

      const textBlock = message.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

      // Parse JSON response — strip markdown fences if Claude adds them anyway
      let rawJson = textBlock.text.trim();
      if (rawJson.startsWith('```')) {
        rawJson = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(rawJson) as GeneratedContent;

      // Validate required fields
      if (!parsed.title || !parsed.content || !parsed.metaTitle || !parsed.metaDescription) {
        throw new Error('Generated content missing required fields');
      }

      // Compute word count and reading time if not provided
      const wordCount = parsed.wordCount || parsed.content.split(/\s+/).length;
      const readingTimeMinutes = parsed.readingTimeMinutes || Math.ceil(wordCount / 250);

      console.log(JSON.stringify({
        event: 'GhostContentGenerated',
        topicId: research.topic.id,
        model: MODEL,
        attempt,
        tokensUsed,
        wordCount,
        faqCount: parsed.faqItems?.length ?? 0,
      }));

      return {
        generated: {
          ...parsed,
          wordCount,
          readingTimeMinutes,
          faqItems: parsed.faqItems ?? [],
          tags: parsed.tags ?? [],
        },
        tokensUsed,
      };
    } catch (err) {
      lastError = err;
      console.warn(JSON.stringify({
        event: 'GhostContentRetry',
        topicId: research.topic.id,
        attempt,
        error: String(err),
      }));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  throw lastError;
}
