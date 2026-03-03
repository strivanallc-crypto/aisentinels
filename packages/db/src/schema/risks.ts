import { integer, pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';
import { isoStandardEnum } from './iso-clauses.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const riskStatusEnum = pgEnum('risk_status', [
  'identified',
  'assessed',
  'treated',
  'accepted',
  'closed',
]);

export const riskCategoryEnum = pgEnum('risk_category', [
  'strategic',
  'operational',
  'financial',
  'compliance',
  'reputational',
  'environmental',
  'health_safety',
  'supply_chain',
  'technology',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Risk register entry.
 * Risk score = likelihood × consequence (1–5 scale each → max 25).
 * Controls describe current mitigations.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const risks = pgTable('risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: riskCategoryEnum('category').notNull(),
  standard: isoStandardEnum('standard'),
  clauseRef: text('clause_ref'),
  /** Likelihood rating 1–5 (1=rare, 5=almost certain) */
  likelihood: integer('likelihood').notNull().default(1),
  /** Consequence rating 1–5 (1=insignificant, 5=catastrophic) */
  consequence: integer('consequence').notNull().default(1),
  /** Computed: likelihood × consequence. Stored for indexed sorting. */
  riskScore: integer('risk_score').generatedAlwaysAs(sql`likelihood * consequence`),
  /** Description of existing controls/mitigations */
  controls: text('controls'),
  /** Residual likelihood after controls (1–5) */
  residualLikelihood: integer('residual_likelihood'),
  /** Residual consequence after controls (1–5) */
  residualConsequence: integer('residual_consequence'),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  status: riskStatusEnum('status').notNull().default('identified'),
  reviewDate: timestamp('review_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_risks_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const risksRelations = relations(risks, ({ one }) => ({
  tenant: one(tenants, { fields: [risks.tenantId], references: [tenants.id] }),
  site: one(sites, { fields: [risks.siteId], references: [sites.id] }),
  owner: one(users, { fields: [risks.ownerId], references: [users.id] }),
}));

export type Risk = typeof risks.$inferSelect;
export type NewRisk = typeof risks.$inferInsert;
