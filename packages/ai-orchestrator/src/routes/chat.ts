/**
 * POST /api/v1/ai/chat
 *
 * RAG-based chat: embed the user query, retrieve relevant document chunks from
 * AOSS, inject as context, generate a response with Gemini 2.5 Pro.
 *
 * Request body:
 *   { message: string; standards?: string[]; topK?: number }
 *
 * Response:
 *   { answer: string; sources: SearchResult[] }
 */
import type { FastifyPluginAsync } from 'fastify';
import { extractClaims } from '../middleware/auth.ts';
import { embedText } from '../lib/vertex-ai.ts';
import { knnSearch, type SearchResult } from '../lib/opensearch.ts';
import { generateChatResponse } from '../lib/vertex-ai.ts';
import { IMS_SYSTEM_PROMPT } from '../lib/rag.ts';

interface ChatBody {
  message: string;
  standards?: string[];
  topK?: number;
}

interface ChatResponse {
  answer: string;
  sources: SearchResult[];
}

export const chatRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ChatBody; Reply: ChatResponse }>(
    '/chat',
    {
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 1, maxLength: 4096 },
            standards: { type: 'array', items: { type: 'string' }, maxItems: 10 },
            topK: { type: 'integer', minimum: 1, maximum: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const claims = extractClaims(request.headers['authorization']);
      const { message, standards, topK = 5 } = request.body;

      // 1. Embed the query
      const [queryEmbedding] = await embedText([message]);
      if (!queryEmbedding) {
        return reply.status(500).send({ message: 'Failed to generate query embedding' } as never);
      }

      // 2. k-NN search scoped to tenant
      const sources = await knnSearch(claims.tenantId, queryEmbedding, topK, standards);

      // 3. Generate response with Gemini
      const answer = await generateChatResponse(
        sources.map((s) => s.chunkText),
        message,
        IMS_SYSTEM_PROMPT,
      );

      return reply.status(200).send({ answer, sources });
    },
  );
};
