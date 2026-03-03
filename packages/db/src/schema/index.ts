/**
 * Schema barrel — re-exports all tables, enums, relations, and types.
 * Import from "@aisentinels/db/schema" in application code.
 *
 * Table dependency order (respects FK constraints):
 *   tenants → sites → users → documents
 *                   ↘ iso_clauses (no tenant FK — seed table)
 *                   → audit_programs → audit_sessions → audit_findings
 *                   → capa_records
 *                   → compliance_records
 *                   → risks
 *                   → evidence_objects
 *                   → subscriptions
 */

// ── Reference / seed tables ───────────────────────────────────────────────────
export * from './iso-clauses.ts';

// ── Core tenant tables ────────────────────────────────────────────────────────
export * from './tenants.ts';
export * from './sites.ts';
export * from './users.ts';
export * from './subscriptions.ts';

// ── Document management ───────────────────────────────────────────────────────
export * from './documents.ts';
export * from './evidence-objects.ts';
export * from './vault-records.ts';

// ── Audit management ──────────────────────────────────────────────────────────
export * from './audit-programs.ts';
export * from './audit-sessions.ts';
export * from './audit-findings.ts';

// ── CAPA & compliance ─────────────────────────────────────────────────────────
export * from './capa-records.ts';
export * from './compliance-records.ts';

// ── Risk management ───────────────────────────────────────────────────────────
export * from './risks.ts';
