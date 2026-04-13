CREATE TYPE "public"."accounting_sync_issue_status" AS ENUM('open', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."billing_cadence" AS ENUM('immediate', 'weekly_arrears', 'monthly_arrears');--> statement-breakpoint
CREATE TYPE "public"."quickbooks_connection_status" AS ENUM('pending', 'active', 'refresh_required', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."quickbooks_environment" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TABLE "accounting_sync_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "integration_provider" DEFAULT 'quickbooks' NOT NULL,
	"connection_id" text,
	"sync_job_id" text,
	"entity_type" text NOT NULL,
	"internal_entity_id" text,
	"external_entity_id" text,
	"status" "accounting_sync_issue_status" DEFAULT 'open' NOT NULL,
	"reason_code" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_auth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"requested_by_user_id" text,
	"redirect_path" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"company_name" text,
	"environment" "quickbooks_environment" DEFAULT 'sandbox' NOT NULL,
	"status" "quickbooks_connection_status" DEFAULT 'pending' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_type" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"connected_by_user_id" text,
	"connected_at" timestamp with time zone,
	"last_refreshed_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "billing_cadence" "billing_cadence" DEFAULT 'monthly_arrears' NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "payment_terms_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD COLUMN "max_attempts" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD COLUMN "dead_letter_reason" text;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "webhook_receipts" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_receipts" ADD COLUMN "verification_error" text;--> statement-breakpoint
ALTER TABLE "webhook_receipts" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_receipts" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting_sync_issues" ADD CONSTRAINT "accounting_sync_issues_connection_id_quickbooks_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."quickbooks_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_sync_issues" ADD CONSTRAINT "accounting_sync_issues_sync_job_id_integration_sync_jobs_id_fk" FOREIGN KEY ("sync_job_id") REFERENCES "public"."integration_sync_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_sync_issues" ADD CONSTRAINT "accounting_sync_issues_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_auth_states" ADD CONSTRAINT "quickbooks_auth_states_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_sync_issues_status_idx" ON "accounting_sync_issues" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "accounting_sync_issues_entity_idx" ON "accounting_sync_issues" USING btree ("entity_type","internal_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_auth_states_state_unique" ON "quickbooks_auth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "quickbooks_auth_states_expires_at_idx" ON "quickbooks_auth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_connections_realm_id_unique" ON "quickbooks_connections" USING btree ("realm_id");--> statement-breakpoint
CREATE INDEX "quickbooks_connections_status_idx" ON "quickbooks_connections" USING btree ("status");--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_cards_branch_active_idx" ON "rate_cards" USING btree ("branch_id","active");