CREATE TYPE "public"."work_order_billable_disposition" AS ENUM('internal', 'customer_damage', 'warranty', 'vendor_recovery');--> statement-breakpoint
CREATE TYPE "public"."work_order_billing_approval_status" AS ENUM('not_required', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."work_order_event_type" AS ENUM('created', 'updated', 'assigned', 'status_changed', 'started', 'awaiting_parts', 'awaiting_vendor', 'repair_completed', 'verified_passed', 'verified_failed', 'cancelled', 'closed', 'note_added', 'labor_added', 'part_added', 'billing_reviewed', 'attachment_added');--> statement-breakpoint
CREATE TYPE "public"."work_order_source_type" AS ENUM('manual', 'inspection_failure', 'dispatch_return', 'telematics_alert', 'customer_report', 'scheduled_maintenance');--> statement-breakpoint
CREATE TYPE "public"."work_order_verification_result" AS ENUM('passed', 'failed');--> statement-breakpoint
CREATE TABLE "maintenance_vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"email" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"event_type" "work_order_event_type" NOT NULL,
	"actor_user_id" text,
	"from_status" "work_order_status",
	"to_status" "work_order_status",
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"verifier_user_id" text,
	"result" "work_order_verification_result" NOT NULL,
	"notes" text,
	"inspection_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_events" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "work_order_events" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'open'::text;--> statement-breakpoint
DROP TYPE "public"."work_order_status";--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('open', 'assigned', 'in_progress', 'awaiting_parts', 'awaiting_vendor', 'repair_completed', 'verified', 'closed', 'cancelled');--> statement-breakpoint
ALTER TABLE "work_order_events" ALTER COLUMN "from_status" SET DATA TYPE "public"."work_order_status" USING "from_status"::"public"."work_order_status";--> statement-breakpoint
ALTER TABLE "work_order_events" ALTER COLUMN "to_status" SET DATA TYPE "public"."work_order_status" USING "to_status"::"public"."work_order_status";--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'open'::"public"."work_order_status";--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DATA TYPE "public"."work_order_status" USING "status"::"public"."work_order_status";--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD COLUMN "work_order_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "work_order_id" text;--> statement-breakpoint
ALTER TABLE "financial_events" ADD COLUMN "work_order_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "contract_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "vendor_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "source_type" "work_order_source_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "symptom_summary" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "diagnosis" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "repair_summary" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "repair_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "verified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "billable_disposition" "work_order_billable_disposition" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "billing_approval_status" "work_order_billing_approval_status" DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "billable_approved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "billable_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_verifications" ADD CONSTRAINT "work_order_verifications_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_verifications" ADD CONSTRAINT "work_order_verifications_verifier_user_id_users_id_fk" FOREIGN KEY ("verifier_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_verifications" ADD CONSTRAINT "work_order_verifications_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_vendors_name_unique" ON "maintenance_vendors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "maintenance_vendors_active_idx" ON "maintenance_vendors" USING btree ("active");--> statement-breakpoint
CREATE INDEX "work_order_events_work_order_id_idx" ON "work_order_events" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_events_created_at_idx" ON "work_order_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "work_order_verifications_work_order_id_idx" ON "work_order_verifications" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_verifications_inspection_id_idx" ON "work_order_verifications" USING btree ("inspection_id");--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendor_id_maintenance_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."maintenance_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_billable_approved_by_user_id_users_id_fk" FOREIGN KEY ("billable_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_allocations_work_order_id_idx" ON "asset_allocations" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "documents_work_order_id_idx" ON "documents" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "financial_events_work_order_id_idx" ON "financial_events" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_orders_contract_id_idx" ON "work_orders" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "work_orders_vendor_id_idx" ON "work_orders" USING btree ("vendor_id");