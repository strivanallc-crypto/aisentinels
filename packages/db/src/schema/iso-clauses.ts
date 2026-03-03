import { boolean, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const isoStandardEnum = pgEnum('iso_standard', [
  'iso_9001',   // Quality Management Systems (2015)
  'iso_14001',  // Environmental Management Systems (2015)
  'iso_45001',  // Occupational Health & Safety (2018)
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Seed/reference table — ISO standard clause definitions.
 * READ-ONLY after seeding. No tenantId — not subject to RLS.
 * App roles: GRANT SELECT only.
 *
 * Seeded by: packages/db/src/seed/seed-iso-clauses.ts
 * Expected rows: ~150 (≥50 per standard)
 */
export const isoClauses = pgTable('iso_clauses', {
  id: uuid('id').primaryKey().defaultRandom(),
  standard: isoStandardEnum('standard').notNull(),
  /** Full clause number, e.g. "8.4.1" */
  clauseNumber: text('clause_number').notNull(),
  /** Annex SL parent clause number, e.g. "8" (top-level HLS element) */
  annexSlId: text('annex_sl_id').notNull(),
  /** Parent clause number for sub-clauses, e.g. "8.4" for "8.4.1"; null for top-level */
  parentClauseNumber: text('parent_clause_number'),
  title: text('title').notNull(),
  /** Full normative requirement text */
  requirementText: text('requirement_text').notNull(),
  /** true = SHALL requirement; false = SHOULD/guidance */
  isMandatory: boolean('is_mandatory').notNull().default(true),
}, (t) => ({
  uqStandardClause: uniqueIndex('uq_iso_clauses_standard_clause').on(t.standard, t.clauseNumber),
}));

export type IsoClause = typeof isoClauses.$inferSelect;
export type NewIsoClause = typeof isoClauses.$inferInsert;
