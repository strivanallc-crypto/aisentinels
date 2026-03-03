/**
 * RAG (Retrieval-Augmented Generation) utilities.
 *
 * - extractTextFromTipTap: Walks TipTap/ProseMirror JSON and collects plain text.
 * - chunkText: Splits text into overlapping token-aware chunks for embedding.
 * - IMS_SYSTEM_PROMPT: System prompt for Gemini — ISO/IMS context instructions.
 */

// ── TipTap text extraction ────────────────────────────────────────────────────

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

/**
 * Recursively walks a TipTap/ProseMirror document node and collects all text
 * node values, joined with spaces. Block-level nodes (paragraph, heading, etc.)
 * are separated by newlines.
 */
export function extractTextFromTipTap(
  bodyJsonb: Record<string, unknown> | null | undefined,
): string {
  if (!bodyJsonb) return '';

  const parts: string[] = [];

  function walk(node: TipTapNode): void {
    if (node.type === 'text' && node.text) {
      parts.push(node.text);
    }
    if (node.content) {
      // Block-level nodes get a newline prefix for separation
      const isBlock = ['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'].includes(
        node.type ?? '',
      );
      if (isBlock && parts.length > 0) parts.push('\n');
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(bodyJsonb as TipTapNode);
  return parts.join('').trim();
}

// ── Text chunking ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 50;
// Rough approximation: 1 token ≈ 4 characters (adequate for chunking, not billing)
const CHARS_PER_TOKEN = 4;

/**
 * Splits text into overlapping chunks sized for embedding (≈ 512 tokens each).
 * Uses word-boundary splitting with a character-based token approximation.
 * Overlap ensures cross-chunk context is preserved for k-NN retrieval.
 */
export function chunkText(
  text: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  overlapTokens: number = DEFAULT_OVERLAP_TOKENS,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  if (trimmed.length <= maxChars) return [trimmed];

  const words = trimmed.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    let charCount = 0;
    let end = start;

    while (end < words.length) {
      const wordLen = (words[end]?.length ?? 0) + 1; // +1 for space
      if (charCount + wordLen > maxChars && end > start) break;
      charCount += wordLen;
      end++;
    }

    const chunk = words.slice(start, end).join(' ');
    if (chunk) chunks.push(chunk);

    // Advance start by (maxChars - overlapChars) worth of words
    const stepChars = maxChars - overlapChars;
    let stepped = 0;
    let nextStart = start;
    while (nextStart < end && stepped < stepChars) {
      stepped += (words[nextStart]?.length ?? 0) + 1;
      nextStart++;
    }
    start = nextStart > start ? nextStart : end; // guard against infinite loop
  }

  return chunks;
}

// ── System prompt ─────────────────────────────────────────────────────────────

export const IMS_SYSTEM_PROMPT = `\
You are an expert ISO management system assistant specializing in integrated management systems (IMS).
You help quality, environmental, health & safety, and information security professionals understand
and apply ISO standards including ISO 9001, ISO 14001, ISO 45001, and ISO 27001.

When answering questions:
1. Ground your response in the provided document context. Cite specific document titles or clause
   references when they are relevant.
2. Be precise and practical. Users are practitioners implementing real management systems.
3. If the context does not contain sufficient information to answer the question confidently, say so
   clearly rather than speculating.
4. Use clear, professional language appropriate for management system documentation.
5. Format responses with clear structure (numbered lists, bullet points) when explaining multi-step
   processes or requirements.

Document context will be provided below. Base your answer primarily on this context.`;
