-- Migration 004: Legal Acceptances
-- Phase 10 — EULA + Terms + Privacy acceptance tracking
-- Run AFTER 001, 002, 003 migrations

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(255) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  document_type   VARCHAR(20) NOT NULL
                  CHECK (document_type IN ('terms','privacy','eula')),
  version         VARCHAR(10) NOT NULL,
  accepted_at     TIMESTAMPTZ DEFAULT NOW(),
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  UNIQUE(tenant_id, user_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_tenant_user
  ON legal_acceptances(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_legal_document_version
  ON legal_acceptances(document_type, version);
