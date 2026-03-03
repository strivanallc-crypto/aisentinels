import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const siteStatusEnum = pgEnum('site_status', ['active', 'inactive', 'archived']);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Physical or logical locations that belong to a tenant.
 * Each site can have its own documents, audits, and risk register.
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  country: text('country').notNull().default('GB'),
  /** IANA timezone identifier, e.g. "Europe/London" */
  timezone: text('timezone').notNull().default('UTC'),
  status: siteStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_sites_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const sitesRelations = relations(sites, ({ one }) => ({
  tenant: one(tenants, { fields: [sites.tenantId], references: [tenants.id] }),
}));

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
