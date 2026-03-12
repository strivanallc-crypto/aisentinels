/**
 * Shared Gemini 2.5 Pro client with SSM-cached API key, retry logic,
 * and per-tenant rate limiting.
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';

// ── SSM-cached API key ──────────────────────────────────────────────────────
const ssm = new SSMClient({});

let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getGeminiApiKey(): Promise<string> {
  if (cachedKey && Date.now() < cacheExpiry) return cachedKey;

  const envName = process.env.ENV_NAME ?? 'prod';
  const { Parameter } = await ssm.send(
    new GetParameterCommand({
      Name: `/aisentinels/${envName}/ai/gemini-api-key`,
      WithDecryption: true,
    }),
  );
  if (!Parameter?.Value) throw new Error('Gemini API key not found in SSM');

  cachedKey = Parameter.Value;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedKey;
}

// ── Rate limiter (per-tenant, in-memory) ────────────────────────────────────
const tenantCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_REQ_PER_MIN = 10;

function checkRateLimit(tenantId: string): void {
  const now = Date.now();
  let entry = tenantCounts.get(tenantId);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    tenantCounts.set(tenantId, entry);
  }
  entry.count++;

  if (entry.count > MAX_REQ_PER_MIN) {
    throw Object.assign(new Error('Rate limit exceeded: 10 requests/minute per tenant'), {
      statusCode: 429,
    });
  }
}

// ── Gemini call with retries ────────────────────────────────────────────────
interface GeminiRequest {
  systemPrompt: string;
  userPrompt: string;
  tenantId: string;
  /** If true, parse the response as JSON */
  jsonMode?: boolean;
  /** Max retries (default 3) */
  maxRetries?: number;
  /** Timeout per attempt in ms (default 30000) */
  timeoutMs?: number;
}

interface GeminiResponse {
  text: string;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function callGemini(req: GeminiRequest): Promise<GeminiResponse> {
  checkRateLimit(req.tenantId);

  const apiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: req.systemPrompt,
    generationConfig: req.jsonMode ? { responseMimeType: 'application/json' } : undefined,
  });

  const maxRetries = req.maxRetries ?? 3;
  const timeoutMs = req.timeoutMs ?? 30_000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result: GenerateContentResult = await Promise.race([
        model.generateContent(req.userPrompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);

      const text = result.response.text();
      const usage = result.response.usageMetadata;
      const tokenUsage = {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      };

      console.log(JSON.stringify({
        event: 'GeminiCall',
        tenantId: req.tenantId,
        model: 'gemini-2.5-pro',
        attempt,
        ...tokenUsage,
      }));

      return { text, tokenUsage };
    } catch (err) {
      lastError = err;
      console.warn(JSON.stringify({
        event: 'GeminiRetry',
        tenantId: req.tenantId,
        attempt,
        error: String(err),
      }));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential backoff
      }
    }
  }

  throw lastError;
}
