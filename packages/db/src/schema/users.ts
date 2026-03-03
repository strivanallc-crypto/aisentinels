import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
  'owner',        // Tenant owner — full access
  'admin',        // Tenant admin — all modules, no billing
  'manager',      // Site manager — approve documents, close CAPAs
  'auditor',      // Internal auditor — read/write audits
  'viewer',       // Read-only
]);

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'invited',
  'suspended',
  'deleted',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Application users, linked 1:1 to a Cognito sub.
 * tenantId enforces multi-tenant isolation via RLS.
 * cognitoSub is unique across all tenants (Cognito pool-level uniqueness).
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** Cognito user sub (UUID from Cognito JWT sub claim) */
  cognitoSub: text('cognito_sub').notNull().unique(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  status: userStatusEnum('status').notNull().default('invited'),
  /** ISO standards this user is responsible for (e.g. ['iso_9001','iso_14001']) */
  standardsResponsible: text('standards_responsible').array().default([]).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_users_tenant_id').on(t.tenantId),
}));


// ── Relations ─────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
