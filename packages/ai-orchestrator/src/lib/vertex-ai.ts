/**
 * Vertex AI client — Gemini generation and text embeddings.
 *
 * Authentication: GCP service account JSON is injected by ECS as GCP_CREDENTIALS_JSON.
 * - Generation: @google-cloud/vertexai GenerativeModel (Gemini 2.5 Pro)
 * - Embeddings: Vertex AI REST API via google-auth-library (text-embedding-004)
 */
import { VertexAI, HarmBlockThreshold, HarmCategory } from '@google-cloud/vertexai';
import { GoogleAuth, type CredentialBody } from 'google-auth-library';

const EMBEDDING_MODEL = 'text-embedding-004';
const GENERATION_MODEL = 'gemini-2.5-pro';
export const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 5; // Vertex AI limit per request

// ── Lazy singletons ───────────────────────────────────────────────────────────

let _vertexAI: VertexAI | undefined;
let _auth: GoogleAuth | undefined;
let _projectId: string | undefined;

interface GcpCredentials {
  project_id?: string;
  [key: string]: unknown;
}

function parseCreds(): GcpCredentials {
  const credsJson = process.env['GCP_CREDENTIALS_JSON'];
  if (!credsJson) throw new Error('GCP_CREDENTIALS_JSON environment variable is not set');
  return JSON.parse(credsJson) as GcpCredentials;
}

function getVertexAI(): VertexAI {
  if (!_vertexAI) {
    const creds = parseCreds();
    const project = creds.project_id ?? '';
    const location = process.env['VERTEX_AI_LOCATION'] ?? 'us-central1';
    if (!project) throw new Error('project_id missing from GCP_CREDENTIALS_JSON');
    _vertexAI = new VertexAI({
      project,
      location,
      googleAuthOptions: { credentials: creds as unknown as CredentialBody },
    });
    _projectId = project;
  }
  return _vertexAI;
}

function getAuth(): GoogleAuth {
  if (!_auth) {
    const creds = parseCreds();
    _auth = new GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    if (!_projectId) _projectId = creds.project_id;
  }
  return _auth;
}

// ── Embeddings ────────────────────────────────────────────────────────────────

interface EmbeddingInstance {
  content: string;
  task_type?: string;
  output_dimensionality?: number;
}

interface EmbeddingPrediction {
  embeddings: {
    values: number[];
    statistics: { token_count: number; truncated: boolean };
  };
}

interface EmbeddingResponse {
  predictions: EmbeddingPrediction[];
}

/**
 * Embeds an array of texts using Vertex AI text-embedding-004.
 * Batched in groups of 5 (API limit). Returns one float vector per text.
 *
 * @param texts - Texts to embed. Use taskType 'RETRIEVAL_DOCUMENT' for indexing,
 *   'RETRIEVAL_QUERY' for search queries (caller is responsible for semantics).
 */
export async function embedText(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const auth = getAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) throw new Error('Failed to obtain GCP access token');

  const project = _projectId ?? parseCreds().project_id ?? '';
  const location = process.env['VERTEX_AI_LOCATION'] ?? 'us-central1';
  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const results: number[][] = [];

  // Process in batches of EMBEDDING_BATCH_SIZE
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const instances: EmbeddingInstance[] = batch.map((content) => ({
      content,
      task_type: 'RETRIEVAL_DOCUMENT',
      output_dimensionality: EMBEDDING_DIMENSIONS,
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instances }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vertex AI embedding request failed ${response.status}: ${body}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    for (const prediction of data.predictions) {
      results.push(prediction.embeddings.values);
    }
  }

  return results;
}

// ── Chat generation ───────────────────────────────────────────────────────────

/**
 * Generates a chat response using Gemini 2.5 Pro with RAG context.
 *
 * @param contextChunks - Relevant document chunks from k-NN search
 * @param userMessage - User's question
 * @param systemPrompt - System prompt (defaults to IMS_SYSTEM_PROMPT from rag.ts)
 */
export async function generateChatResponse(
  contextChunks: string[],
  userMessage: string,
  systemPrompt: string,
): Promise<string> {
  const vertexAI = getVertexAI();
  const model = vertexAI.getGenerativeModel({
    model: GENERATION_MODEL,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
  });

  const contextSection =
    contextChunks.length > 0
      ? `\n\n--- Relevant document context ---\n${contextChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}\n--- End context ---\n\n`
      : '';

  const prompt = `${contextSection}Question: ${userMessage}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text;
}
