-- =============================================================================
-- AI Sentinels — Row Level Security (RLS) policy definitions
-- =============================================================================
-- Applied by: packages/db/src/migrate.ts (step 4, after Drizzle migrations)
-- Safe to run manually: psql $DATABASE_URL -f src/rls.sql
-- All statements are idempotent — safe to re-run on any environment.
--
-- Security model:
--   • app_role (NOINHERIT) — used by Lambda & Fargate at runtime
--   • Every request MUST call: SET LOCAL app.tenant_id = '<uuid>'
--   • iso_clauses is a read-only seed table — no RLS, SELECT only
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── App role ──────────────────────────────────────────────────────────────────
-- NOINHERIT: cannot escalate to superuser-adjacent privileges.
-- LOGIN is not granted — app_role is used via SET ROLE, not direct auth.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role NOINHERIT;
  END IF;
END $$;

-- ── Seed table: iso_clauses (no RLS — read-only reference data) ───────────────
GRANT SELECT ON TABLE iso_clauses TO app_role;

-- =============================================================================
-- Tenant-scoped tables — RLS enabled + isolation policy + DML grants
-- Applied to all 11 tables that carry tenant_id.
-- =============================================================================

-- ── sites ─────────────────────────────────────────────────────────────────────
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sites' AND policyname = 'sites_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY sites_tenant_isolation ON sites
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sites TO app_role;

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY users_tenant_isolation ON users
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO app_role;

-- ── subscriptions ─────────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY subscriptions_tenant_isolation ON subscriptions
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE subscriptions TO app_role;

-- ── documents ─────────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY documents_tenant_isolation ON documents
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE documents TO app_role;

-- ── evidence_objects ──────────────────────────────────────────────────────────
ALTER TABLE evidence_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_objects FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evidence_objects' AND policyname = 'evidence_objects_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY evidence_objects_tenant_isolation ON evidence_objects
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE evidence_objects TO app_role;

-- ── audit_programs ────────────────────────────────────────────────────────────
ALTER TABLE audit_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_programs FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_programs' AND policyname = 'audit_programs_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY audit_programs_tenant_isolation ON audit_programs
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_programs TO app_role;

-- ── audit_sessions ────────────────────────────────────────────────────────────
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_sessions' AND policyname = 'audit_sessions_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY audit_sessions_tenant_isolation ON audit_sessions
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_sessions TO app_role;

-- ── audit_findings ────────────────────────────────────────────────────────────
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_findings' AND policyname = 'audit_findings_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY audit_findings_tenant_isolation ON audit_findings
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_findings TO app_role;

-- ── capa_records ──────────────────────────────────────────────────────────────
ALTER TABLE capa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE capa_records FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'capa_records' AND policyname = 'capa_records_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY capa_records_tenant_isolation ON capa_records
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE capa_records TO app_role;

-- ── compliance_records ────────────────────────────────────────────────────────
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'compliance_records' AND policyname = 'compliance_records_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY compliance_records_tenant_isolation ON compliance_records
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE compliance_records TO app_role;

-- ── risks ─────────────────────────────────────────────────────────────────────
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'risks' AND policyname = 'risks_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY risks_tenant_isolation ON risks
        USING      (tenant_id = current_setting('app.tenant_id')::UUID)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID)
    $p$;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE risks TO app_role;

-- ── Sequence grants ───────────────────────────────────────────────────────────
-- app_role needs USAGE on sequences to generate UUIDs via gen_random_uuid()
-- (pgcrypto sequences, not serial sequences — but safe to grant proactively)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- =============================================================================
-- Verification query (run manually after applying):
-- SELECT tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename
-- WHERE schemaname = 'public' AND tablename != 'iso_clauses'
-- ORDER BY tablename;
-- Expected: rowsecurity = true, forcerowsecurity = true for all 11 tables
-- =============================================================================
