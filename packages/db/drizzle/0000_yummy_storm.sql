CREATE TYPE "public"."iso_standard" AS ENUM('iso_9001', 'iso_14001', 'iso_45001');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'cancelled', 'trial');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'manager', 'auditor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('policy', 'procedure', 'work_instruction', 'form', 'record', 'manual', 'plan', 'specification', 'external');--> statement-breakpoint
CREATE TYPE "public"."audit_program_status" AS ENUM('planning', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_type" AS ENUM('internal', 'supplier', 'certification', 'surveillance');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('major_nc', 'minor_nc', 'observation', 'opportunity');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('open', 'in_capa', 'closed');--> statement-breakpoint
CREATE TYPE "public"."capa_source_type" AS ENUM('audit_finding', 'customer_complaint', 'nonconformity', 'incident', 'management_review', 'risk_assessment', 'employee_suggestion');--> statement-breakpoint
CREATE TYPE "public"."capa_status" AS ENUM('open', 'in_progress', 'pending_verification', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."root_cause_method" AS ENUM('five_why', 'fishbone', 'fault_tree', 'eight_d', 'pareto');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('conforming', 'partial', 'nonconforming', 'not_applicable', 'not_assessed');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('strategic', 'operational', 'financial', 'compliance', 'reputational', 'environmental', 'health_safety', 'supply_chain', 'technology');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('identified', 'assessed', 'treated', 'accepted', 'closed');--> statement-breakpoint
CREATE TABLE "iso_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard" "iso_standard" NOT NULL,
	"clause_number" text NOT NULL,
	"annex_sl_id" text NOT NULL,
	"parent_clause_number" text,
	"title" text NOT NULL,
	"requirement_text" text NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"country" text DEFAULT 'GB' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" "site_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cognito_sub" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"standards_responsible" text[] DEFAULT '{}' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wise_invoice_id" text,
	"wise_transfer_id" text,
	"plan" "subscription_plan" NOT NULL,
	"status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"ai_credits_used" integer DEFAULT 0 NOT NULL,
	"ai_credits_limit" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"title" text NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"standards" text[] DEFAULT '{}' NOT NULL,
	"clause_refs" text[] DEFAULT '{}' NOT NULL,
	"body_jsonb" jsonb,
	"status" "doc_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"effective_date" timestamp with time zone,
	"review_date" timestamp with time zone,
	"sha256_hash" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid,
	"s3_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"sha256_hash" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"standards" text[] DEFAULT '{}' NOT NULL,
	"objectives" text,
	"status" "audit_program_status" DEFAULT 'planning' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"program_id" uuid,
	"site_id" uuid,
	"title" text NOT NULL,
	"audit_type" "audit_type" DEFAULT 'internal' NOT NULL,
	"lead_auditor_id" uuid,
	"audit_date" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"clause_refs" text[] DEFAULT '{}' NOT NULL,
	"status" "audit_session_status" DEFAULT 'scheduled' NOT NULL,
	"summary" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"clause_ref" text NOT NULL,
	"standard" "iso_standard" NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"description" text NOT NULL,
	"evidence_ids" uuid[] DEFAULT '{}' NOT NULL,
	"capa_id" uuid,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capa_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"source_type" "capa_source_type" NOT NULL,
	"source_id" uuid,
	"standard" "iso_standard" NOT NULL,
	"clause_ref" text NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"problem_description" text NOT NULL,
	"root_cause_method" "root_cause_method" DEFAULT 'five_why' NOT NULL,
	"root_cause_analysis" text,
	"actions_jsonb" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_id" uuid NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "capa_status" DEFAULT 'open' NOT NULL,
	"closed_date" timestamp with time zone,
	"effectiveness_verified" boolean DEFAULT false NOT NULL,
	"effectiveness_verified_by" uuid,
	"effectiveness_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"standard" "iso_standard" NOT NULL,
	"clause_number" text NOT NULL,
	"status" "compliance_status" DEFAULT 'not_assessed' NOT NULL,
	"evidence" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"assessed_at" timestamp with time zone NOT NULL,
	"assessed_by" uuid NOT NULL,
	"next_review_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "risk_category" NOT NULL,
	"standard" "iso_standard",
	"clause_ref" text,
	"likelihood" integer DEFAULT 1 NOT NULL,
	"consequence" integer DEFAULT 1 NOT NULL,
	"risk_score" integer GENERATED ALWAYS AS (likelihood * consequence) STORED,
	"controls" text,
	"residual_likelihood" integer,
	"residual_consequence" integer,
	"owner_id" uuid,
	"status" "risk_status" DEFAULT 'identified' NOT NULL,
	"review_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_objects" ADD CONSTRAINT "evidence_objects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_objects" ADD CONSTRAINT "evidence_objects_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_programs" ADD CONSTRAINT "audit_programs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_programs" ADD CONSTRAINT "audit_programs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_programs" ADD CONSTRAINT "audit_programs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_program_id_audit_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."audit_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_lead_auditor_id_users_id_fk" FOREIGN KEY ("lead_auditor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capa_records" ADD CONSTRAINT "capa_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capa_records" ADD CONSTRAINT "capa_records_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capa_records" ADD CONSTRAINT "capa_records_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capa_records" ADD CONSTRAINT "capa_records_effectiveness_verified_by_users_id_fk" FOREIGN KEY ("effectiveness_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iso_clauses_standard_clause" ON "iso_clauses" USING btree ("standard","clause_number");--> statement-breakpoint
CREATE INDEX "idx_sites_tenant_id" ON "sites" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_id" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_tenant_id" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant_id" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_objects_tenant_id" ON "evidence_objects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_programs_tenant_id" ON "audit_programs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_sessions_tenant_id" ON "audit_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_findings_tenant_id" ON "audit_findings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_capa_records_tenant_id" ON "capa_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_records_tenant_id" ON "compliance_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_risks_tenant_id" ON "risks" USING btree ("tenant_id");