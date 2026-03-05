import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants.ts';
import { users } from './users.ts';

// =============================================================================
// Organization Context, Standards, Roles, Brain — Phase 3 tables
// =============================================================================

// ── org_context ─────────────────────────────────────────────────────────────
/**
 * One row per tenant — the organization's identity and profile.
 * Used by all sentinels to contextualize generated content.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const orgContext = pgTable('org_context', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  /** manufacturing | construction | food | energy | other */
  industry: text('industry'),
  country: text('country'),
  employeeCount: integer('employee_count'),
  /** Formal IMS scope statement per ISO 4.3 */
  imsScope: text('ims_scope'),
  /** e.g. ['ISO 9001','ISO 14001','ISO 45001'] */
  certificationTargets: text('certification_targets').array().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgContextRelations = relations(orgContext, ({ one }) => ({
  tenant: one(tenants, { fields: [orgContext.tenantId], references: [tenants.id] }),
}));

export type OrgContext = typeof orgContext.$inferSelect;
export type NewOrgContext = typeof orgContext.$inferInsert;

// ── org_standards ───────────────────────────────────────────────────────────
/**
 * Which ISO standards a tenant has activated.
 * Controls which sentinels are active (Qualy, Envi, Saffy).
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const orgStandards = pgTable('org_standards', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** 'ISO 9001' | 'ISO 14001' | 'ISO 45001' */
  standardCode: text('standard_code').notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
  activatedBy: uuid('activated_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  uniqTenantStandard: unique('uq_org_standards_tenant_code').on(t.tenantId, t.standardCode),
  idxTenantId: index('idx_org_standards_tenant_id').on(t.tenantId),
}));

export const orgStandardsRelations = relations(orgStandards, ({ one }) => ({
  tenant: one(tenants, { fields: [orgStandards.tenantId], references: [tenants.id] }),
  activator: one(users, { fields: [orgStandards.activatedBy], references: [users.id] }),
}));

export type OrgStandard = typeof orgStandards.$inferSelect;
export type NewOrgStandard = typeof orgStandards.$inferInsert;

// ── org_roles ───────────────────────────────────────────────────────────────
/**
 * Role definitions per tenant (system + custom roles).
 * System roles: Admin, Quality Manager, Internal Auditor, Document Controller, Viewer.
 * Permissions stored as JSONB for flexible extension.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const orgRoles = pgTable('org_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  roleName: text('role_name').notNull(),
  /** e.g. { canApproveDocuments: true, canCreateAudits: true, ... } */
  permissions: jsonb('permissions').$type<Record<string, boolean>>().default({}).notNull(),
  isSystemRole: boolean('is_system_role').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantId: index('idx_org_roles_tenant_id').on(t.tenantId),
}));

export const orgRolesRelations = relations(orgRoles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orgRoles.tenantId], references: [tenants.id] }),
  userRoles: many(userRoles),
}));

export type OrgRole = typeof orgRoles.$inferSelect;
export type NewOrgRole = typeof orgRoles.$inferInsert;

// ── user_roles ──────────────────────────────────────────────────────────────
/**
 * Junction table: assigns org_roles to users.
 * A user can have multiple roles within a tenant.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id')
    .notNull()
    .references(() => orgRoles.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqTenantUserRole: unique('uq_user_roles_tenant_user_role').on(t.tenantId, t.userId, t.roleId),
  idxTenantId: index('idx_user_roles_tenant_id').on(t.tenantId),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  tenant: one(tenants, { fields: [userRoles.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(orgRoles, { fields: [userRoles.roleId], references: [orgRoles.id] }),
  assigner: one(users, { fields: [userRoles.assignedBy], references: [users.id] }),
}));

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

// ── org_documents ───────────────────────────────────────────────────────────
/**
 * Tenant-uploaded manuals — the Brain's source material.
 * Actual files stored in S3 working-files bucket.
 * Processing pipeline: pending → chunking → ready | failed.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const orgDocuments = pgTable('org_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  s3Key: text('s3_key').notNull(),
  /** pdf | docx | txt */
  fileType: text('file_type'),
  /** qms_manual | ems_manual | ohs_manual | procedure | policy | other */
  docCategory: text('doc_category'),
  /** 'ISO 9001' | 'ISO 14001' | 'ISO 45001' | null (cross-standard) */
  relatedStandard: text('related_standard'),
  /** pending | chunking | ready | failed */
  processingStatus: text('processing_status').default('pending').notNull(),
  chunkCount: integer('chunk_count').default(0).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (t) => ({
  idxTenantId: index('idx_org_documents_tenant_id').on(t.tenantId),
}));

export const orgDocumentsRelations = relations(orgDocuments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orgDocuments.tenantId], references: [tenants.id] }),
  uploader: one(users, { fields: [orgDocuments.uploadedBy], references: [users.id] }),
  chunks: many(orgKnowledgeChunks),
}));

export type OrgDocument = typeof orgDocuments.$inferSelect;
export type NewOrgDocument = typeof orgDocuments.$inferInsert;

// ── org_knowledge_chunks ────────────────────────────────────────────────────
/**
 * RAG chunks — what sentinels actually read.
 * Each chunk is ~400-500 tokens of content from an uploaded document.
 * Chunks are ordered by chunk_index for sequential reading.
 *
 * RLS policy: tenant_id = current_setting('app.tenant_id')::UUID
 */
export const orgKnowledgeChunks = pgTable('org_knowledge_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  orgDocumentId: uuid('org_document_id')
    .notNull()
    .references(() => orgDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  /** ~400-500 tokens of document content */
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  /** Page number in original document (if available) */
  sourcePage: integer('source_page'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxTenantDocument: index('idx_org_knowledge_chunks_tenant_doc').on(t.tenantId, t.orgDocumentId),
  idxTenantChunk: index('idx_org_knowledge_chunks_tenant_chunk').on(t.tenantId, t.chunkIndex),
}));

export const orgKnowledgeChunksRelations = relations(orgKnowledgeChunks, ({ one }) => ({
  tenant: one(tenants, { fields: [orgKnowledgeChunks.tenantId], references: [tenants.id] }),
  orgDocument: one(orgDocuments, {
    fields: [orgKnowledgeChunks.orgDocumentId],
    references: [orgDocuments.id],
  }),
}));

export type OrgKnowledgeChunk = typeof orgKnowledgeChunks.$inferSelect;
export type NewOrgKnowledgeChunk = typeof orgKnowledgeChunks.$inferInsert;
