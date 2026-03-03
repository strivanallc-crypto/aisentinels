import { pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { auditSessions } from './audit-sessions.ts';
import { isoStandardEnum } from './iso-clauses.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const findingSeverityEnum = pgEnum('finding_severity', [
  'major_nc',      // Major nonconformity — critical, system breakdown
  'minor_nc',      // Minor nonconformity — isolated departure from requirement
  'observation',   // Observation — potential risk, not yet nonconformance
  'opportunity',   // Opportunity for improvement (OFI)
]);

export const findingStatusEnum = pgEnum('finding_status', [
  'open',
  'in_capa',      // CAPA raised, work in progress
  'closed',       // Evidence accepted, finding resolved
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Individual findings raised during an audit session.
 * May link to a CAPA record for corrective action tracking.
 * Evidence stored as reference to evidence_objects IDs.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const auditFindings = pgTable('audit_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => auditSessions.id, { onDelete: 'cascade' }),
  /** ISO standard clause reference, e.g. "8.4.1" */
  clauseRef: text('clause_ref').notNull(),
  standard: isoStandardEnum('standard').notNull(),
  severity: findingSeverityEnum('severity').notNull(),
  description: text('description').notNull(),
  /** UUIDs referencing evidence_objects.id */
  evidenceIds: uuid('evidence_ids').array().default([]).notNull(),
  /** Optional CAPA raised from this finding */
  capaId: uuid('capa_id'),
  status: findingStatusEnum('status').notNull().default('open'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_audit_findings_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const auditFindingsRelations = relations(auditFindings, ({ one }) => ({
  tenant: one(tenants, { fields: [auditFindings.tenantId], references: [tenants.id] }),
  session: one(auditSessions, { fields: [auditFindings.sessionId], references: [auditSessions.id] }),
}));

export type AuditFinding = typeof auditFindings.$inferSelect;
export type NewAuditFinding = typeof auditFindings.$inferInsert;
