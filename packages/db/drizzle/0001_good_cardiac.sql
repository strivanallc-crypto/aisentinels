CREATE TYPE "public"."record_category" AS ENUM('quality', 'safety', 'training', 'calibration', 'audit', 'incident', 'environmental');--> statement-breakpoint
CREATE TABLE "vault_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"title" text NOT NULL,
	"category" "record_category" NOT NULL,
	"retention_years" integer DEFAULT 7 NOT NULL,
	"retention_expires_at" timestamp with time zone,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"legal_hold_reason" text,
	"legal_hold_at" timestamp with time zone,
	"content_text" text,
	"sha256_hash" text,
	"integrity_verified_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_records" ADD CONSTRAINT "vault_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_records" ADD CONSTRAINT "vault_records_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_records" ADD CONSTRAINT "vault_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_vault_records_tenant_id" ON "vault_records" USING btree ("tenant_id");