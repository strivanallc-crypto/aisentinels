import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';
import { isoStandardEnum } from './iso-clauses.ts';
import { findingSeverityEnum } from './audit-findings.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const rootCauseMethodEnum = pgEnum('root_cause_method', [
  'five_why',
  'fishbone',       // Ishikawa / cause-and-effect diagram
  'fault_tree',     // Fault Tree Analysis
  'eight_d',        // 8D report method
  'pareto',         // Pareto analysis
]);

export const capaStatusEnum = pgEnum('capa_status', [
  'open',
  'in_progress',
  'pending_verification',
  'closed',
  'cancelled',
]);

export const capaSourceTypeEnum = pgEnum('capa_source_type', [
  'audit_finding',
  'customer_complaint',
  'nonconformity',
  'incident',
  'management_review',
  'risk_assessment',
  'employee_suggestion',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Corrective and Preventive Action records.
 * actionsJsonb: array of { id, description, ownerId, dueDate, completedAt, status }
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const capaRecords = pgTable('capa_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  sourceType: capaSourceTypeEnum('source_type').notNull(),
  /** Reference ID of the source record (e.g. audit_findings.id) */
  sourceId: uuid('source_id'),
  standard: isoStandardEnum('standard').notNull(),
  clauseRef: text('clause_ref').notNull(),
  severity: findingSeverityEnum('severity').notNull(),
  /** Describe the nonconformity or issue */
  problemDescription: text('problem_description').notNull(),
  rootCauseMethod: rootCauseMethodEnum('root_cause_method').notNull().default('five_why'),
  rootCauseAnalysis: text('root_cause_analysis'),
  /** Array of action items: {id, description, ownerId, dueDate, completedAt, status} */
  actionsJsonb: jsonb('actions_jsonb')
    .$type<Array<{
      id: string;
      description: string;
      ownerId: string;
      dueDate: string;
      completedAt?: string;
      status: 'open' | 'in_progress' | 'completed';
    }>>()
    .default([])
    .notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: capaStatusEnum('status').notNull().default('open'),
  closedDate: timestamp('closed_date', { withTimezone: true }),
  /** Has the effectiveness of the corrective action been verified? */
  effectivenessVerified: boolean('effectiveness_verified').notNull().default(false),
  effectivenessVerifiedBy: uuid('effectiveness_verified_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  effectivenessVerifiedAt: timestamp('effectiveness_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_capa_records_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const capaRecordsRelations = relations(capaRecords, ({ one }) => ({
  tenant: one(tenants, { fields: [capaRecords.tenantId], references: [tenants.id] }),
  site: one(sites, { fields: [capaRecords.siteId], references: [sites.id] }),
  owner: one(users, { fields: [capaRecords.ownerId], references: [users.id] }),
}));

export type CapaRecord = typeof capaRecords.$inferSelect;
export type NewCapaRecord = typeof capaRecords.$inferInsert;
