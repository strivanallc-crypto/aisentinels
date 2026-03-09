/**
 * Shared Claude Sonnet client with SSM-cached API key, retry logic,
 * and per-tenant concurrency limiting.
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import Anthropic from '@anthropic-ai/sdk';

// ── SSM-cached API key ──────────────────────────────────────────────────────
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

// ── Concurrency limiter (per-tenant, in-memory) ─────────────────────────────
const activeCalls = new Map<string, number>();
const MAX_CONCURRENT = 5;

function acquireConcurrencySlot(tenantId: string): void {
  const current = activeCalls.get(tenantId) ?? 0;
  if (current >= MAX_CONCURRENT) {
    throw Object.assign(
      new Error('Claude concurrency limit: 5 concurrent requests per tenant'),
      { statusCode: 429 },
    );
  }
  activeCalls.set(tenantId, current + 1);
}

function releaseConcurrencySlot(tenantId: string): void {
  const current = activeCalls.get(tenantId) ?? 0;
  if (current <= 1) {
    activeCalls.delete(tenantId);
  } else {
    activeCalls.set(tenantId, current - 1);
  }
}

// ── Claude call with retries ────────────────────────────────────────────────
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeRequest {
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;  // default 4096
  tenantId: string;
}

interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

const MODEL = 'claude-sonnet-4-5';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 60_000;

export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  acquireConcurrencySlot(req.tenantId);

  try {
    const apiKey = await getAnthropicApiKey();
    const client = new Anthropic({ apiKey, maxRetries: 0 });
    const maxTokens = req.maxTokens ?? 4096;

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const message = await Promise.race([
          client.messages.create({
            model: MODEL,
            max_tokens: maxTokens,
            system: req.systemPrompt,
            messages: req.messages,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Claude timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
          ),
        ]);

        const textBlock = message.content.find((block) => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text response from Claude');
        }

        const inputTokens = message.usage.input_tokens;
        const outputTokens = message.usage.output_tokens;

        console.log(JSON.stringify({
          event: 'ClaudeCall',
          tenantId: req.tenantId,
          model: MODEL,
          attempt,
          inputTokens,
          outputTokens,
        }));

        return { content: textBlock.text, inputTokens, outputTokens };
      } catch (err) {
        lastError = err;
        console.warn(JSON.stringify({
          event: 'ClaudeRetry',
          tenantId: req.tenantId,
          attempt,
          error: String(err),
        }));
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential backoff
        }
      }
    }

    throw lastError;
  } finally {
    releaseConcurrencySlot(req.tenantId);
  }
}
