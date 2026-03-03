/**
 * POST /api/v1/ai/embed
 *
 * Synchronous document embedding: loads a document from Aurora (with RLS),
 * extracts text from TipTap JSON body, chunks it, embeds via text-embedding-004,
 * and upserts chunks to AOSS.
 *
 * Request body:
 *   { documentId: string }
 *
 * Response:
 *   { documentId: string; chunksIndexed: number }
 *
 * All three steps (load → embed → index) are idempotent — safe to retry.
 */
import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '@aisentinels/db';
import * as schema from '@aisentinels/db/schema';
import { documents } from '@aisentinels/db/schema';
import type { Sql } from 'postgres';
import { extractClaims } from '../middleware/auth.ts';
import { embedText } from '../lib/vertex-ai.ts';
import { bulkIndexChunks, type DocumentChunk } from '../lib/opensearch.ts';
import { extractTextFromTipTap, chunkText } from '../lib/rag.ts';

// ── DB singleton ──────────────────────────────────────────────────────────────

let _db: { db: Db; client: Sql } | null = null;

async function getDbInstance(): Promise<{ db: Db; client: Sql }> {
  if (!_db) {
    _db = await createDb({ iamAuth: true });
  }
  return _db;
}

// ── Tenant context (RLS) ──────────────────────────────────────────────────────

async function withTenantContext<T>(
  client: Sql,
  tenantId: string,
  fn: (txDb: Db) => Promise<T>,
): Promise<T> {
  // Cast the result of begin() to T — postgres.js's UnwrapPromiseArray<T> wraps Promise<T>
  // to T at runtime, but TypeScript infers the return type as Promise<UnwrapPromiseArray<T>>.
  // Capturing as unknown and casting to T resolves the type mismatch safely.
  const result: unknown = await client.begin(async (txSql) => {
    // txSql is TransactionSql — cast to Sql for tagged template and drizzle() compat
    const sql = txSql as unknown as Sql;
    await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    // Must wrap sql in a new drizzle instance so queries use the transaction connection (RLS)
    const txDb = drizzle(sql, { schema }) as Db;
    return fn(txDb);
  });
  return result as T;
}

// ── Route ─────────────────────────────────────────────────────────────────────

interface EmbedBody {
  documentId: string;
}

interface EmbedResponse {
  documentId: string;
  chunksIndexed: number;
}

export const embedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: EmbedBody; Reply: EmbedResponse }>(
    '/embed',
    {
      schema: {
        body: {
          type: 'object',
          required: ['documentId'],
          properties: {
            documentId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const claims = extractClaims(request.headers['authorization']);
      const { documentId } = request.body;

      const { client } = await getDbInstance();

      // 1. Load document from Aurora with tenant RLS enforced
      const document = await withTenantContext(client, claims.tenantId, async (txDb) => {
        const rows = await txDb
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1);
        return rows[0] ?? null;
      });

      if (!document) {
        return reply
          .status(404)
          .send({ message: `Document ${documentId} not found` } as never);
      }

      // 2. Extract plain text from TipTap JSON body
      const text = extractTextFromTipTap(document.bodyJsonb);
      if (!text) {
        return reply.status(200).send({ documentId, chunksIndexed: 0 });
      }

      // 3. Chunk text into ~512-token pieces
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        return reply.status(200).send({ documentId, chunksIndexed: 0 });
      }

      // 4. Embed all chunks (batched internally)
      const embeddings = await embedText(chunks);

      // 5. Build DocumentChunk array
      const documentChunks: DocumentChunk[] = chunks.map((chunkText, i) => ({
        tenantId: claims.tenantId,
        documentId,
        chunkIndex: i,
        chunkText,
        embedding: embeddings[i] ?? [],
        standards: document.standards ?? [],
        clauseRefs: document.clauseRefs ?? [],
        docType: document.docType,
      }));

      // 6. Upsert to AOSS (bulk API, idempotent by composite ID)
      await bulkIndexChunks(documentChunks);

      return reply.status(200).send({ documentId, chunksIndexed: chunks.length });
    },
  );
};
