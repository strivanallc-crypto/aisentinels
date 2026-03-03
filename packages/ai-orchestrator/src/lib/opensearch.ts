/**
 * OpenSearch Serverless (AOSS) client.
 *
 * Uses AWS SigV4 authentication with service='aoss' (not 'es').
 * IRSA / ECS task role credentials are picked up automatically by defaultProvider.
 *
 * Index: 'documents-v1'
 * Mapping: k-NN vector (768-dim, faiss/hnsw, cosine similarity) + metadata fields.
 */
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { EMBEDDING_DIMENSIONS } from './vertex-ai.ts';

export const INDEX_NAME = 'documents-v1';

// ── Client singleton ──────────────────────────────────────────────────────────

let _client: Client | undefined;

export async function getClient(): Promise<Client> {
  if (!_client) {
    const endpoint = process.env['AOSS_COLLECTION_ENDPOINT'];
    if (!endpoint) throw new Error('AOSS_COLLECTION_ENDPOINT environment variable is not set');

    const region = process.env['AWS_DEFAULT_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1';

    _client = new Client({
      ...AwsSigv4Signer({
        region,
        service: 'aoss',
        getCredentials: () => {
          const provider = defaultProvider();
          return provider();
        },
      }),
      node: endpoint,
    });
  }
  return _client;
}

// ── Index management ──────────────────────────────────────────────────────────

const INDEX_MAPPING = {
  settings: {
    index: {
      knn: true,
    },
  },
  mappings: {
    properties: {
      tenantId: { type: 'keyword' },
      documentId: { type: 'keyword' },
      chunkIndex: { type: 'integer' },
      chunkText: { type: 'text' },
      embedding: {
        type: 'knn_vector',
        dimension: EMBEDDING_DIMENSIONS,
        method: {
          name: 'hnsw',
          engine: 'faiss',
          space_type: 'cosinesimil',
          parameters: { ef_construction: 128, m: 16 },
        },
      },
      standards: { type: 'keyword' },
      clauseRefs: { type: 'keyword' },
      docType: { type: 'keyword' },
    },
  },
};

/**
 * Idempotent: creates the index with k-NN mapping if it does not already exist.
 * Called once at server startup.
 */
export async function ensureAossIndex(): Promise<void> {
  const client = await getClient();

  let indexExists = false;
  try {
    const response = await client.indices.exists({ index: INDEX_NAME });
    indexExists = response.statusCode === 200;
  } catch {
    indexExists = false;
  }

  if (!indexExists) {
    await client.indices.create({ index: INDEX_NAME, body: INDEX_MAPPING });
  }
}

// ── Document types ────────────────────────────────────────────────────────────

export interface DocumentChunk {
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  standards: string[];
  clauseRefs: string[];
  docType: string;
}

export interface SearchResult {
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

// ── Indexing ──────────────────────────────────────────────────────────────────

/**
 * Upserts document chunks via the OpenSearch bulk API.
 * Document ID is a composite: `{tenantId}#{documentId}#{chunkIndex}`.
 */
export async function bulkIndexChunks(chunks: DocumentChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const client = await getClient();

  const operations: Record<string, unknown>[] = [];
  for (const chunk of chunks) {
    const docId = `${chunk.tenantId}#${chunk.documentId}#${chunk.chunkIndex}`;
    operations.push({ index: { _index: INDEX_NAME, _id: docId } });
    operations.push({ ...chunk } as Record<string, unknown>);
  }

  const response = await client.bulk({ body: operations as unknown as string[] });
  if (response.body.errors as boolean) {
    const errorItems = (response.body.items as Array<Record<string, unknown>>).filter(
      (item) => (item['index'] as Record<string, unknown> | undefined)?.['error'],
    );
    throw new Error(
      `Bulk index had ${errorItems.length} errors: ${JSON.stringify(errorItems[0])}`,
    );
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * k-NN vector search scoped to a single tenant.
 *
 * @param tenantId - Tenant isolation filter (all tenants share one index)
 * @param queryEmbedding - Query vector from embedText()
 * @param topK - Number of results to return
 * @param filterStandards - Optional ISO standard filter (e.g. ['iso_9001'])
 */
export async function knnSearch(
  tenantId: string,
  queryEmbedding: number[],
  topK: number,
  filterStandards?: string[],
): Promise<SearchResult[]> {
  const client = await getClient();

  const filters: unknown[] = [{ term: { tenantId } }];
  if (filterStandards && filterStandards.length > 0) {
    filters.push({ terms: { standards: filterStandards } });
  }

  const query = {
    size: topK,
    query: {
      bool: {
        filter: filters,
        must: [
          {
            knn: {
              embedding: {
                vector: queryEmbedding,
                k: topK,
              },
            },
          },
        ],
      },
    },
  };

  const response = await client.search({ index: INDEX_NAME, body: query });

  interface HitSource {
    documentId: string;
    chunkIndex: number;
    chunkText: string;
  }

  interface Hit {
    _source: HitSource;
    _score: number;
  }

  const hits = (response.body?.hits?.hits ?? []) as Hit[];
  return hits.map((hit) => ({
    documentId: hit._source.documentId,
    chunkIndex: hit._source.chunkIndex,
    chunkText: hit._source.chunkText,
    score: hit._score,
  }));
}
