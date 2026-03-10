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
import { users } from './users.ts';

// ── Enums ──────────────────────────────────────────────────────────────────────
export const webhookStatusEnum = pgEnum('webhook_status', [
  'active',
  'paused',
  'disabled',
]);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'success',
  'failed',
]);

// ── webhook_endpoints ─────────────────────────────────────────────────────────
/**
 * Tenant-scoped webhook endpoint subscriptions.
 * Each endpoint has a signing secret for HMAC-SHA256 verification.
 * Subscribed event types control which events trigger delivery.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** Target URL (must be HTTPS in production) */
  url: text('url').notNull(),
  /** Human-readable description */
  description: text('description'),
  /** HMAC-SHA256 signing secret — generated on creation */
  secret: text('secret').notNull(),
  /** Event types this endpoint subscribes to
   *  e.g. ['document.created', 'audit.completed', 'capa.created'] */
  eventTypes: text('event_types').array().default([]).notNull(),
  status: webhookStatusEnum('status').notNull().default('active'),
  /** Consecutive failure count — auto-disable after threshold */
  failureCount: integer('failure_count').default(0).notNull(),
  /** When was the last successful delivery? */
  lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_webhook_endpoints_tenant_id').on(t.tenantId),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  tenant: one(tenants, { fields: [webhookEndpoints.tenantId], references: [tenants.id] }),
  creator: one(users, { fields: [webhookEndpoints.createdBy], references: [users.id] }),
  deliveries: many(webhookDeliveries),
}));

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

// ── webhook_deliveries ────────────────────────────────────────────────────────
/**
 * Delivery log for webhook events.
 * Each row = one HTTP POST attempt to a webhook endpoint.
 * Stored for 90 days (application-level cleanup via scheduled job).
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  endpointId: uuid('endpoint_id')
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  /** Event type that triggered this delivery (e.g. 'document.created') */
  eventType: text('event_type').notNull(),
  /** Full payload sent to the endpoint */
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  /** HTTP response status code (null if network error) */
  responseStatus: integer('response_status'),
  /** First 2KB of response body (for debugging) */
  responseBody: text('response_body'),
  status: deliveryStatusEnum('status').notNull().default('pending'),
  /** Attempt number (1-based, max 3 retries) */
  attempt: integer('attempt').default(1).notNull(),
  /** Round-trip time in milliseconds */
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantEndpoint: index('idx_webhook_deliveries_tenant_endpoint').on(t.tenantId, t.endpointId),
  idxTenantEvent: index('idx_webhook_deliveries_tenant_event').on(t.tenantId, t.eventType),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  tenant: one(tenants, { fields: [webhookDeliveries.tenantId], references: [tenants.id] }),
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
