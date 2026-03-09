import { integer, pgEnum, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'starter',        // 1 site, 1 standard, up to 5 users
  'professional',   // 5 sites, 3 standards, up to 25 users
  'enterprise',     // Unlimited sites/standards, SSO, custom AI limits
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
]);

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Tenant subscription state, updated by Wise webhook events.
 * One active subscription per tenant (older rows kept for billing history).
 * aiCreditsUsed is incremented by AI service; reset on billing cycle start.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** Wise invoice/payment ID for reconciliation */
  wiseInvoiceId: text('wise_invoice_id'),
  /** Wise transfer/batch ID for bulk payments */
  wiseTransferId: text('wise_transfer_id'),
  plan: subscriptionPlanEnum('plan').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('trial'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  /** Gemini AI credits consumed this billing period */
  aiCreditsUsed: integer('ai_credits_used').notNull().default(0),
  /** Monthly credit limit per plan (starter=50, professional=200, enterprise=500) */
  aiCreditsLimit: integer('ai_credits_limit').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_subscriptions_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, { fields: [subscriptions.tenantId], references: [tenants.id] }),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
