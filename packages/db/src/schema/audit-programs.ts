import { integer, pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const auditProgramStatusEnum = pgEnum('audit_program_status', [
  'planning',
  'active',
  'completed',
  'cancelled',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Annual/periodic audit programme — container for multiple audit sessions.
 * Typically one programme per year per site per standard.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const auditPrograms = pgTable('audit_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  /** ISO standards covered, e.g. ['iso_9001', 'iso_14001'] */
  standards: text('standards').array().default([]).notNull(),
  objectives: text('objectives'),
  status: auditProgramStatusEnum('status').notNull().default('planning'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_audit_programs_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const auditProgramsRelations = relations(auditPrograms, ({ one, many }) => ({
  tenant: one(tenants, { fields: [auditPrograms.tenantId], references: [tenants.id] }),
  site: one(sites, { fields: [auditPrograms.siteId], references: [sites.id] }),
  creator: one(users, { fields: [auditPrograms.createdBy], references: [users.id] }),
  sessions: many(auditSessions),
}));

// Circular-safe: used only inside lazy many() callback
import { auditSessions } from './audit-sessions.ts';

export type AuditProgram = typeof auditPrograms.$inferSelect;
export type NewAuditProgram = typeof auditPrograms.$inferInsert;
