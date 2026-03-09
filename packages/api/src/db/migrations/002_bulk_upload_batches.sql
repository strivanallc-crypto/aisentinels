-- ============================================================================
-- Migration 002: Bulk Upload Batches + Items
-- Phase 8-A — Bulk upload pipeline tracking tables.
--
-- Run AFTER 001_create_blog_posts.sql.
-- Execute via psql with RLS-aware superuser or migration role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bulk_upload_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(255) NOT NULL,
  created_by    VARCHAR(255) NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','processing','completed','failed')),
  total_files   INTEGER NOT NULL,
  processed     INTEGER DEFAULT 0,
  succeeded     INTEGER DEFAULT 0,
  failed        INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bulk_upload_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
  tenant_id     VARCHAR(255) NOT NULL,
  filename      VARCHAR(500) NOT NULL,
  file_type     VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf','docx')),
  file_size     INTEGER,
  s3_key        VARCHAR(1000),
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','uploaded','processing','completed','failed')),
  document_id   UUID,           -- FK to documents table after processing
  sentinel      VARCHAR(50),    -- which sentinel Omni routed to
  iso_standard  VARCHAR(50),    -- detected ISO standard
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bulk_batches_tenant
  ON bulk_upload_batches(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bulk_items_batch
  ON bulk_upload_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_bulk_items_tenant
  ON bulk_upload_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bulk_items_status
  ON bulk_upload_items(status);
