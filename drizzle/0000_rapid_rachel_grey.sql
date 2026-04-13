CREATE TYPE "public"."asset_availability" AS ENUM('rentable', 'limited', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('available', 'reserved', 'dispatched', 'on_rent', 'inspection_hold', 'in_maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('commercial_box_trailer', 'office_trailer', 'storage_container', 'specialty_trailer', 'chassis');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('asset', 'customer', 'customer_location', 'contract', 'contract_line', 'financial_event', 'invoice', 'user', 'dispatch_task', 'inspection', 'work_order', 'payment_method', 'collection_case');--> statement-breakpoint
CREATE TYPE "public"."billing_unit" AS ENUM('day', 'week', 'month', 'flat', 'mileage', 'event');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('current', 'reminder_sent', 'promise_to_pay', 'disputed', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('quoted', 'reserved', 'active', 'completed', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('commercial', 'government', 'municipal', 'non_profit', 'internal');--> statement-breakpoint
CREATE TYPE "public"."dispatch_task_status" AS ENUM('unassigned', 'assigned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dispatch_task_type" AS ENUM('delivery', 'pickup', 'swap', 'return', 'checkout', 'checkin');--> statement-breakpoint
CREATE TYPE "public"."financial_event_status" AS ENUM('pending', 'posted', 'invoiced', 'voided');--> statement-breakpoint
CREATE TYPE "public"."financial_event_type" AS ENUM('rent', 'damage', 'delivery', 'pickup', 'surcharge', 'credit', 'adjustment', 'tax');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('requested', 'in_progress', 'passed', 'failed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."inspection_type" AS ENUM('delivery', 'return', 'damage_assessment', 'maintenance_release', 'spot_check');--> statement-breakpoint
CREATE TYPE "public"."integration_direction" AS ENUM('push', 'pull', 'bidirectional', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('stripe', 'quickbooks', 'record360', 'skybitz', 'dropbox_sign', 'internal');--> statement-breakpoint
CREATE TYPE "public"."integration_sync_status" AS ENUM('pending', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('clear', 'scheduled', 'under_repair', 'waiting_on_parts', 'inspection_required');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('card', 'ach', 'wire', 'check');--> statement-breakpoint
CREATE TYPE "public"."rate_scope" AS ENUM('standard', 'customer', 'branch', 'promotional');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'sales', 'dispatcher', 'accounting', 'technician', 'collections', 'portal');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('open', 'assigned', 'in_progress', 'awaiting_parts', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_number" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"subtype" text,
	"dimensions" jsonb,
	"branch_id" text NOT NULL,
	"status" "asset_status" DEFAULT 'available' NOT NULL,
	"availability" "asset_availability" DEFAULT 'rentable' NOT NULL,
	"gps_device_id" text,
	"maintenance_status" "maintenance_status" DEFAULT 'clear' NOT NULL,
	"age_in_months" integer,
	"features" jsonb,
	"serial_number" text,
	"manufactured_at" timestamp with time zone,
	"purchase_date" timestamp with time zone,
	"record360_unit_id" text,
	"skybitz_asset_id" text,
	"telematics_provider" "integration_provider",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"phone" text,
	"email" text,
	"address" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"owner_user_id" text,
	"status" "collection_status" DEFAULT 'current' NOT NULL,
	"promised_payment_date" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"notes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"asset_id" text,
	"description" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit" "billing_unit" NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"adjustments" jsonb,
	"delivery_fee" numeric(12, 2),
	"pickup_fee" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"location_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"sales_rep_id" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"status" "contract_status" DEFAULT 'quoted' NOT NULL,
	"quoted_at" timestamp with time zone,
	"reserved_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"address" jsonb NOT NULL,
	"contact_person" jsonb,
	"delivery_notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_number" text NOT NULL,
	"name" text NOT NULL,
	"customer_type" "customer_type" NOT NULL,
	"contact_info" jsonb NOT NULL,
	"billing_address" jsonb NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"credit_limit" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"contract_id" text,
	"asset_id" text,
	"customer_location_id" text,
	"task_type" "dispatch_task_type" NOT NULL,
	"status" "dispatch_task_status" DEFAULT 'unassigned' NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone,
	"driver_name" text,
	"notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_events" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text,
	"contract_line_id" text,
	"asset_id" text,
	"invoice_id" text,
	"event_type" "financial_event_type" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"status" "financial_event_status" DEFAULT 'pending' NOT NULL,
	"external_reference" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"contract_id" text,
	"customer_location_id" text,
	"inspection_type" "inspection_type" NOT NULL,
	"status" "inspection_status" DEFAULT 'requested' NOT NULL,
	"external_inspection_id" text,
	"result_summary" text,
	"damage_score" integer,
	"photos" jsonb,
	"record360_payload" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"direction" "integration_direction" NOT NULL,
	"status" "integration_sync_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"last_error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"source_financial_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"contract_id" text,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"balance_amount" numeric(12, 2) NOT NULL,
	"quick_books_invoice_id" text,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"provider" "integration_provider" DEFAULT 'stripe' NOT NULL,
	"method_type" "payment_method_type" NOT NULL,
	"stripe_payment_method_id" text,
	"last4" text,
	"brand" text,
	"ach_bank_name" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" "rate_scope" NOT NULL,
	"customer_id" text,
	"asset_type" "asset_type",
	"daily_rate" numeric(12, 2),
	"weekly_rate" numeric(12, 2),
	"monthly_rate" numeric(12, 2),
	"mileage_rate" numeric(12, 2),
	"delivery_fee" numeric(12, 2),
	"pickup_fee" numeric(12, 2),
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telematics_pings" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"provider" "integration_provider" DEFAULT 'skybitz' NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"heading" integer,
	"speed_mph" numeric(6, 2),
	"captured_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"branch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"inspection_id" text,
	"branch_id" text NOT NULL,
	"assigned_to_user_id" text,
	"status" "work_order_status" DEFAULT 'open' NOT NULL,
	"priority" text,
	"title" text NOT NULL,
	"description" text,
	"vendor_name" text,
	"estimated_cost" numeric(12, 2),
	"actual_cost" numeric(12, 2),
	"labor_hours" numeric(8, 2),
	"parts" jsonb,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_location_id_customer_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."customer_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_sales_rep_id_users_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_locations" ADD CONSTRAINT "customer_locations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_customer_location_id_customer_locations_id_fk" FOREIGN KEY ("customer_location_id") REFERENCES "public"."customer_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_contract_line_id_contract_lines_id_fk" FOREIGN KEY ("contract_line_id") REFERENCES "public"."contract_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_customer_location_id_customer_locations_id_fk" FOREIGN KEY ("customer_location_id") REFERENCES "public"."customer_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_pings" ADD CONSTRAINT "telematics_pings_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_asset_number_unique" ON "assets" USING btree ("asset_number");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_gps_device_id_unique" ON "assets" USING btree ("gps_device_id");--> statement-breakpoint
CREATE INDEX "assets_branch_status_idx" ON "assets" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "assets_availability_maintenance_idx" ON "assets" USING btree ("availability","maintenance_status");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_user_id_idx" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_code_unique" ON "branches" USING btree ("code");--> statement-breakpoint
CREATE INDEX "collection_cases_customer_status_idx" ON "collection_cases" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "collection_cases_invoice_id_idx" ON "collection_cases" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "contract_lines_contract_id_idx" ON "contract_lines" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_lines_asset_id_idx" ON "contract_lines" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_contract_number_unique" ON "contracts" USING btree ("contract_number");--> statement-breakpoint
CREATE INDEX "contracts_customer_status_idx" ON "contracts" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "contracts_branch_status_idx" ON "contracts" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "contracts_location_id_idx" ON "contracts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "customer_locations_customer_id_idx" ON "customer_locations" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_customer_number_unique" ON "customers" USING btree ("customer_number");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_customer_type_idx" ON "customers" USING btree ("customer_type");--> statement-breakpoint
CREATE INDEX "dispatch_tasks_branch_status_idx" ON "dispatch_tasks" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "dispatch_tasks_asset_id_idx" ON "dispatch_tasks" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "dispatch_tasks_contract_id_idx" ON "dispatch_tasks" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "financial_events_contract_status_idx" ON "financial_events" USING btree ("contract_id","status");--> statement-breakpoint
CREATE INDEX "financial_events_asset_id_idx" ON "financial_events" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "financial_events_invoice_id_idx" ON "financial_events" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "financial_events_event_date_idx" ON "financial_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "inspections_asset_status_idx" ON "inspections" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "inspections_contract_id_idx" ON "inspections" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "integration_sync_jobs_provider_status_idx" ON "integration_sync_jobs" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "integration_sync_jobs_entity_idx" ON "integration_sync_jobs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_unique" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_customer_status_idx" ON "invoices" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "invoices_contract_id_idx" ON "invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payment_methods_customer_default_idx" ON "payment_methods" USING btree ("customer_id","is_default");--> statement-breakpoint
CREATE INDEX "rate_cards_customer_active_idx" ON "rate_cards" USING btree ("customer_id","active");--> statement-breakpoint
CREATE INDEX "rate_cards_asset_type_active_idx" ON "rate_cards" USING btree ("asset_type","active");--> statement-breakpoint
CREATE INDEX "telematics_pings_asset_captured_at_idx" ON "telematics_pings" USING btree ("asset_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_branch_role_idx" ON "users" USING btree ("branch_id","role");--> statement-breakpoint
CREATE INDEX "work_orders_asset_status_idx" ON "work_orders" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "work_orders_branch_status_idx" ON "work_orders" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "work_orders_inspection_id_idx" ON "work_orders" USING btree ("inspection_id");