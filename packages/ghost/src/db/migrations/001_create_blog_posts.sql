-- Ghost Sentinel — Database Migration 001
-- Creates blog_posts and ghost_run_reports tables.
--
-- These tables are platform-level (not tenant-scoped) — blog content
-- is published publicly on aisentinels.io. No RLS policies needed.

-- ── blog_posts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_posts (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  meta_title             TEXT NOT NULL,
  meta_description       TEXT NOT NULL,
  excerpt                TEXT NOT NULL DEFAULT '',
  content                TEXT NOT NULL,                -- Markdown source
  content_html           TEXT NOT NULL DEFAULT '',      -- Rendered HTML
  category               TEXT NOT NULL,
  tags                   TEXT[] NOT NULL DEFAULT '{}',
  author                 TEXT NOT NULL DEFAULT 'Ghost — AI Sentinels',
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'review', 'published', 'archived')),
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  topic_id               TEXT NOT NULL,
  run_id                 TEXT NOT NULL,
  word_count             INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes   INTEGER NOT NULL DEFAULT 0,
  seo_score              INTEGER NOT NULL DEFAULT 0
                           CHECK (seo_score >= 0 AND seo_score <= 100),
  schema_markup          TEXT NOT NULL DEFAULT '{}',    -- Article JSON-LD
  faq_schema             TEXT,                          -- FAQ JSON-LD (nullable)
  perplexity_sources     TEXT[] NOT NULL DEFAULT '{}',  -- Citation URLs
  claude_tokens_used     INTEGER NOT NULL DEFAULT 0,
  perplexity_tokens_used INTEGER NOT NULL DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug        ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status      ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category    ON blog_posts (category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_topic_id    ON blog_posts (topic_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published   ON blog_posts (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created     ON blog_posts (created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();


-- ── ghost_run_reports ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ghost_run_reports (
  run_id            TEXT PRIMARY KEY,
  trigger_mode      TEXT NOT NULL
                      CHECK (trigger_mode IN ('eventbridge', 'manual')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'completed', 'failed')),
  topic_id          TEXT NOT NULL,
  topic_title       TEXT NOT NULL,
  blog_post_id      TEXT REFERENCES blog_posts(id),
  research_tokens   INTEGER NOT NULL DEFAULT 0,
  content_tokens    INTEGER NOT NULL DEFAULT 0,
  error             TEXT
);

-- Indexes for monitoring and reporting
CREATE INDEX IF NOT EXISTS idx_ghost_runs_status     ON ghost_run_reports (status);
CREATE INDEX IF NOT EXISTS idx_ghost_runs_started    ON ghost_run_reports (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_runs_topic      ON ghost_run_reports (topic_id);
