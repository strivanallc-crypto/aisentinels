import { pgEnum, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
  'cancelled',
  'trial',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** URL-safe slug — unique identifier used in subdomains/paths */
  slug: text('slug').notNull().unique(),
  status: tenantStatusEnum('status').notNull().default('trial'),
  /** Flexible tenant-level config (timezone, locale, logo URL, etc.) */
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Relations (referenced by downstream tables) ───────────────────────────────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  sites: many(sites),
  users: many(users),
}));

// Circular-safe: these are used only inside lazy callbacks in relations()
import { sites } from './sites.ts';
import { users } from './users.ts';

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
