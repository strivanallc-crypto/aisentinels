import { integer, pgTable, text, timestamp, uuid, index} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { users } from './users.ts';

// ── Table ─────────────────────────────────────────────────────────────────────
/**
 * Metadata for files uploaded to the working-files S3 bucket.
 * Actual file stored at s3Key in aisentinels-working-files-{region}.
 * sha256Hash enables tamper detection and deduplication.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const evidenceObjects = pgTable('evidence_objects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** Optional parent document ID if evidence belongs to a specific document */
  documentId: uuid('document_id'),
  /** Full S3 object key within the working-files bucket */
  s3Key: text('s3_key').notNull(),
  /** Original filename as uploaded by the user */
  fileName: text('file_name').notNull(),
  /** MIME type, e.g. "application/pdf", "image/png" */
  fileType: text('file_type').notNull(),
  /** File size in bytes */
  fileSizeBytes: integer('file_size_bytes').notNull(),
  /** SHA-256 hex hash of file content */
  sha256Hash: text('sha256_hash').notNull(),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_evidence_objects_tenant_id').on(t.tenantId),
}));

// ── Relations ─────────────────────────────────────────────────────────────────
export const evidenceObjectsRelations = relations(evidenceObjects, ({ one }) => ({
  tenant: one(tenants, { fields: [evidenceObjects.tenantId], references: [tenants.id] }),
  uploader: one(users, { fields: [evidenceObjects.uploadedBy], references: [users.id] }),
}));

export type EvidenceObject = typeof evidenceObjects.$inferSelect;
export type NewEvidenceObject = typeof evidenceObjects.$inferInsert;
