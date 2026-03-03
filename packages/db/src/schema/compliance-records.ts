import { pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';
import { isoStandardEnum } from './iso-clauses.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const complianceStatusEnum = pgEnum('compliance_status', [
  'conforming',
  'partial',
  'nonconforming',
  'not_applicable',
  'not_assessed',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Per-clause compliance status assessment for a given site.
 * Provides the compliance dashboard heat-map data.
 * One row per (tenantId, siteId, standard, clauseNumber) combination.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const complianceRecords = pgTable('compliance_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  standard: isoStandardEnum('standard').notNull(),
  clauseNumber: text('clause_number').notNull(),
  status: complianceStatusEnum('status').notNull().default('not_assessed'),
  /** S3 keys or document IDs providing evidence of compliance */
  evidence: text('evidence').array().default([]).notNull(),
  notes: text('notes'),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull(),
  assessedBy: uuid('assessed_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  nextReviewDate: timestamp('next_review_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_compliance_records_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const complianceRecordsRelations = relations(complianceRecords, ({ one }) => ({
  tenant: one(tenants, { fields: [complianceRecords.tenantId], references: [tenants.id] }),
  site: one(sites, { fields: [complianceRecords.siteId], references: [sites.id] }),
  assessor: one(users, { fields: [complianceRecords.assessedBy], references: [users.id] }),
}));

export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type NewComplianceRecord = typeof complianceRecords.$inferInsert;
