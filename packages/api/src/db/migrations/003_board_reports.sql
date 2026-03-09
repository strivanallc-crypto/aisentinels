-- Phase 9-A: Board Performance Reports table
-- Stores metadata for generated monthly board reports.
-- PDF files are stored in S3 (exports bucket).

CREATE TABLE IF NOT EXISTS board_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(255) NOT NULL,
  report_period   VARCHAR(7) NOT NULL,  -- 'YYYY-MM'
  status          VARCHAR(20) DEFAULT 'generating'
                  CHECK (status IN ('generating','ready','failed')),
  s3_key          VARCHAR(1000),
  generated_at    TIMESTAMPTZ,
  generated_by    VARCHAR(20) DEFAULT 'manual'
                  CHECK (generated_by IN ('scheduled','manual')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, report_period)
);

CREATE INDEX IF NOT EXISTS idx_board_reports_tenant
  ON board_reports(tenant_id);

CREATE INDEX IF NOT EXISTS idx_board_reports_period
  ON board_reports(report_period DESC);
