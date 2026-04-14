CREATE TABLE "invoice_history" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_cases" ADD COLUMN "next_step" text;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD COLUMN "sla_bucket" text;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD COLUMN "dispute_state" text;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD COLUMN "reminder_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD COLUMN "recovery_escalation" text;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD COLUMN "latest_portal_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "external_unit_id" text;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "record360_sync_state" text DEFAULT 'pending_sync' NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "last_sync_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "last_sync_error" text;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "webhook_matched_by" text;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "provider_event_id" text;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "provider_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "last_processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "delivery_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "delivery_channel" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "quick_books_sync_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "quick_books_last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "quick_books_last_error" text;--> statement-breakpoint
ALTER TABLE "telematics_pings" ADD COLUMN "source" text DEFAULT 'provider' NOT NULL;--> statement-breakpoint
ALTER TABLE "telematics_pings" ADD COLUMN "trust_level" text DEFAULT 'authoritative' NOT NULL;--> statement-breakpoint
ALTER TABLE "telematics_pings" ADD COLUMN "last_provider_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_history_invoice_id_idx" ON "invoice_history" USING btree ("invoice_id","created_at");