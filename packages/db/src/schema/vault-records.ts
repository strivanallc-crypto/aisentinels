import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { sites } from './sites.ts';
import { users } from './users.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const recordCategoryEnum = pgEnum('record_category', [
  'quality',
  'safety',
  'training',
  'calibration',
  'audit',
  'incident',
  'environmental',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Immutable records vault — controlled records with retention and legal-hold
 * management (ISO 9001 Clause 7.5.3).
 *
 * Integrity verification: SHA-256 of contentText is stored at creation time.
 * POST /{id}/verify-integrity recomputes and compares to detect tampering.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const vaultRecords = pgTable('vault_records', {
  id:      uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),

  title:    text('title').notNull(),
  category: recordCategoryEnum('category').notNull(),

  /** Retention period in whole years (default 7 years — ISO 9001 minimum) */
  retentionYears:     integer('retention_years').notNull().default(7),
  /** Computed at creation: createdAt + retentionYears years */
  retentionExpiresAt: timestamp('retention_expires_at', { withTimezone: true }),

  /** Legal hold flag — prevents destruction even after retention period */
  legalHold:       boolean('legal_hold').notNull().default(false),
  legalHoldReason: text('legal_hold_reason'),
  legalHoldAt:     timestamp('legal_hold_at', { withTimezone: true }),

  /** Plain-text record content (may be null for file-backed records) */
  contentText: text('content_text'),
  /** SHA-256 hex digest of contentText — computed at creation for tamper detection */
  sha256Hash:  text('sha256_hash'),
  /** Set when integrity check passes; null = not yet verified / pending */
  integrityVerifiedAt: timestamp('integrity_verified_at', { withTimezone: true }),

  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_vault_records_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const vaultRecordsRelations = relations(vaultRecords, ({ one }) => ({
  tenant:    one(tenants, { fields: [vaultRecords.tenantId],  references: [tenants.id] }),
  site:      one(sites,   { fields: [vaultRecords.siteId],    references: [sites.id] }),
  createdBy: one(users,   { fields: [vaultRecords.createdBy], references: [users.id] }),
}));

export type VaultRecord    = typeof vaultRecords.$inferSelect;
export type NewVaultRecord = typeof vaultRecords.$inferInsert;
