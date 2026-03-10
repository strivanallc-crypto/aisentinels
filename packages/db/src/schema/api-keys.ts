import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { users } from './users.ts';

// ── api_keys ──────────────────────────────────────────────────────────────────
/**
 * Tenant-scoped API keys for external integrations.
 * The raw key is shown ONCE on creation, then only prefix + last4 stored.
 * keyHash = SHA-256 hex of the full key — used for authentication.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** Human-readable label (e.g. "Production ERP Integration") */
  name: text('name').notNull(),
  /** First 8 chars of the key (e.g. "ask_prod") — for UI display */
  prefix: text('prefix').notNull(),
  /** Last 4 chars of the key — for UI identification */
  last4: text('last4').notNull(),
  /** SHA-256 hex hash of the full API key — used for lookup + auth */
  keyHash: text('key_hash').notNull().unique(),
  /** Scopes: e.g. ['documents:read', 'audits:read', 'capa:read'] */
  scopes: text('scopes').array().default([]).notNull(),
  /** Optional expiry — null means never expires */
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  /** Soft-revoke — revoked keys fail auth immediately */
  revoked: boolean('revoked').default(false).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  /** Last time this key was used to authenticate a request */
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_api_keys_tenant_id').on(t.tenantId),
  idxKeyHash: index('idx_api_keys_key_hash').on(t.keyHash),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, { fields: [apiKeys.tenantId], references: [tenants.id] }),
  creator: one(users, { fields: [apiKeys.createdBy], references: [users.id] }),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
