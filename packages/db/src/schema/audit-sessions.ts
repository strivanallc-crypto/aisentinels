import { pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';
import { auditPrograms } from './audit-programs.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const auditSessionStatusEnum = pgEnum('audit_session_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const auditTypeEnum = pgEnum('audit_type', [
  'internal',
  'supplier',
  'certification',
  'surveillance',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Individual audit event within an audit programme.
 * Generates findings that may trigger CAPAs.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const auditSessions = pgTable('audit_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').references(() => auditPrograms.id, { onDelete: 'set null' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  auditType: auditTypeEnum('audit_type').notNull().default('internal'),
  leadAuditorId: uuid('lead_auditor_id').references(() => users.id, { onDelete: 'set null' }),
  auditDate: timestamp('audit_date', { withTimezone: true }).notNull(),
  /** Specific processes/areas audited */
  scope: text('scope').notNull(),
  /** Clause references covered in this session */
  clauseRefs: text('clause_refs').array().default([]).notNull(),
  status: auditSessionStatusEnum('status').notNull().default('scheduled'),
  summary: text('summary'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_audit_sessions_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const auditSessionsRelations = relations(auditSessions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [auditSessions.tenantId], references: [tenants.id] }),
  program: one(auditPrograms, { fields: [auditSessions.programId], references: [auditPrograms.id] }),
  site: one(sites, { fields: [auditSessions.siteId], references: [sites.id] }),
  leadAuditor: one(users, { fields: [auditSessions.leadAuditorId], references: [users.id] }),
  findings: many(auditFindings),
}));

// Circular-safe: used only inside lazy many() callback
import { auditFindings } from './audit-findings.ts';

export type AuditSession = typeof auditSessions.$inferSelect;
export type NewAuditSession = typeof auditSessions.$inferInsert;
