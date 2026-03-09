/**
 * Ghost DB Client — Aurora PostgreSQL connection for blog storage.
 *
 * Mirrors the singleton pattern from packages/api handlers.
 * Uses @aisentinels/db createDb() with IAM auth for production.
 *
 * Ghost operates at platform level (not tenant-scoped), so no RLS
 * transaction wrapper is needed — blog_posts are public content.
 */
import { createDb } from '@aisentinels/db';
import type postgres from 'postgres';

// ── Singleton DB connection ─────────────────────────────────────────────────

let _dbInstance: { client: postgres.Sql } | null = null;

/**
 * Get a singleton postgres.js client for Ghost database operations.
 *
 * Production: IAM auth via RDS Proxy (AURORA_IAM_AUTH=true)
 * Development: plaintext DATABASE_URL
 */
export async function getDbClient(): Promise<postgres.Sql> {
  if (!_dbInstance) {
    const isIam = process.env.AURORA_IAM_AUTH === 'true';
    const result = await createDb(
      isIam
        ? { iamAuth: true }
        : { url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/aisentinels' },
    );
    _dbInstance = { client: result.client };
  }
  return _dbInstance.client;
}

// ── Blog Post Queries ───────────────────────────────────────────────────────

/**
 * Insert a new blog post into the database.
 * Returns the inserted post ID.
 */
export async function insertBlogPost(post: {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;
  contentHtml: string;
  category: string;
  tags: string[];
  author: string;
  status: string;
  publishedAt: string | null;
  topicId: string;
  runId: string;
  wordCount: number;
  readingTimeMinutes: number;
  seoScore: number;
  schemaMarkup: string;
  faqSchema: string | null;
  perplexitySources: string[];
  claudeTokensUsed: number;
  perplexityTokensUsed: number;
}): Promise<string> {
  const sql = await getDbClient();

  await sql`
    INSERT INTO blog_posts (
      id, slug, title, meta_title, meta_description, excerpt,
      content, content_html, category, tags, author, status,
      published_at, topic_id, run_id, word_count, reading_time_minutes,
      seo_score, schema_markup, faq_schema, perplexity_sources,
      claude_tokens_used, perplexity_tokens_used
    ) VALUES (
      ${post.id}, ${post.slug}, ${post.title}, ${post.metaTitle},
      ${post.metaDescription}, ${post.excerpt}, ${post.content},
      ${post.contentHtml}, ${post.category}, ${post.tags},
      ${post.author}, ${post.status}, ${post.publishedAt},
      ${post.topicId}, ${post.runId}, ${post.wordCount},
      ${post.readingTimeMinutes}, ${post.seoScore}, ${post.schemaMarkup},
      ${post.faqSchema}, ${post.perplexitySources},
      ${post.claudeTokensUsed}, ${post.perplexityTokensUsed}
    )
  `;

  return post.id;
}

// ── Ghost Run Report Queries ────────────────────────────────────────────────

/**
 * Insert a new Ghost run report (start of pipeline).
 */
export async function insertRunReport(report: {
  runId: string;
  triggerMode: string;
  topicId: string;
  topicTitle: string;
}): Promise<void> {
  const sql = await getDbClient();

  await sql`
    INSERT INTO ghost_run_reports (
      run_id, trigger_mode, started_at, status,
      topic_id, topic_title, research_tokens, content_tokens
    ) VALUES (
      ${report.runId}, ${report.triggerMode}, NOW(), 'running',
      ${report.topicId}, ${report.topicTitle}, 0, 0
    )
  `;
}

/**
 * Complete a Ghost run report (pipeline finished).
 */
export async function completeRunReport(params: {
  runId: string;
  status: 'completed' | 'failed';
  blogPostId: string | null;
  researchTokens: number;
  contentTokens: number;
  error: string | null;
}): Promise<void> {
  const sql = await getDbClient();

  await sql`
    UPDATE ghost_run_reports
    SET completed_at = NOW(),
        status = ${params.status},
        blog_post_id = ${params.blogPostId},
        research_tokens = ${params.researchTokens},
        content_tokens = ${params.contentTokens},
        error = ${params.error}
    WHERE run_id = ${params.runId}
  `;
}

/**
 * Get published topic IDs and their last-published dates.
 * Used by getNextTopic() for topic selection logic.
 */
export async function getPublishedTopicInfo(): Promise<{
  publishedIds: Set<string>;
  lastPublishedMap: Map<string, string>;
}> {
  const sql = await getDbClient();

  const rows = await sql<{ topic_id: string; last_published: string }[]>`
    SELECT topic_id, MAX(created_at)::text AS last_published
    FROM blog_posts
    WHERE status IN ('published', 'draft', 'review')
    GROUP BY topic_id
  `;

  const publishedIds = new Set<string>();
  const lastPublishedMap = new Map<string, string>();

  for (const row of rows) {
    publishedIds.add(row.topic_id);
    lastPublishedMap.set(row.topic_id, row.last_published);
  }

  return { publishedIds, lastPublishedMap };
}
