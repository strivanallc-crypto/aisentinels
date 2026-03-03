import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const docTypeEnum = pgEnum('doc_type', [
  'policy',
  'procedure',
  'work_instruction',
  'form',
  'record',
  'manual',
  'plan',
  'specification',
  'external',
]);

export const docStatusEnum = pgEnum('doc_status', [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Controlled document register — all tenant documents.
 * Body stored as JSONB (rich text / Tiptap JSON format).
 * Integrity verified via SHA-256 hash on upload.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  docType: docTypeEnum('doc_type').notNull(),
  /** ISO standards this document covers, e.g. ['iso_9001', 'iso_14001'] */
  standards: text('standards').array().default([]).notNull(),
  /** Specific clause references, e.g. ['8.4.1', '7.5.3'] */
  clauseRefs: text('clause_refs').array().default([]).notNull(),
  /** Document body as Tiptap/ProseMirror JSON */
  bodyJsonb: jsonb('body_jsonb').$type<Record<string, unknown>>(),
  status: docStatusEnum('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  effectiveDate: timestamp('effective_date', { withTimezone: true }),
  reviewDate: timestamp('review_date', { withTimezone: true }),
  /** SHA-256 hex hash of the rendered PDF/body for tamper detection */
  sha256Hash: text('sha256_hash'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_documents_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const documentsRelations = relations(documents, ({ one }) => ({
  tenant: one(tenants, { fields: [documents.tenantId], references: [tenants.id] }),
  site: one(sites, { fields: [documents.siteId], references: [sites.id] }),
  approver: one(users, { fields: [documents.approvedBy], references: [users.id] }),
  creator: one(users, { fields: [documents.createdBy], references: [users.id] }),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
