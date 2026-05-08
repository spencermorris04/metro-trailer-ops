DO $$ BEGIN
  ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'road_trailer';
  ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'cartage_trailer';
  ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'storage_trailer';
  ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'flatbed_trailer';
  ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'reefer_trailer';
  ALTER TYPE "public"."asset_type" ADD VALUE IF NOT EXISTS 'yard_truck';
  ALTER TYPE "public"."integration_provider" ADD VALUE IF NOT EXISTS 'business_central';
  ALTER TYPE "public"."audit_entity_type" ADD VALUE IF NOT EXISTS 'commercial_event';
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."agreement_kind" AS ENUM ('quote', 'rental_order', 'lease', 'legacy_posted_invoice', 'credit_memo', 'blanket_order');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."import_completeness" AS ENUM ('header_only', 'lines_complete', 'ledger_complete', 'fully_reconciled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."contract_line_kind" AS ENUM ('rental', 'lease', 'delivery', 'pickup', 'damage_waiver', 'resource', 'service', 'sale', 'buyout', 'tax', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."invoice_source_kind" AS ENUM ('app_native', 'bc_posted_rental', 'bc_sales_document');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."revenue_recognition_basis" AS ENUM ('rental_period', 'one_time', 'buyout', 'damage', 'tax', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."bc_import_run_status" AS ENUM ('pending', 'running', 'succeeded', 'partial_failure', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."subledger_document_status" AS ENUM ('draft', 'open', 'posted', 'partially_applied', 'closed', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."journal_line_side" AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."journal_entry_status" AS ENUM ('draft', 'posted', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."posting_rule_scope" AS ENUM ('contract', 'invoice', 'receipt', 'bill', 'payment', 'fixed_asset', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cash_transaction_type" AS ENUM ('receipt', 'disbursement', 'transfer', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "manufacturer" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "model_year" integer;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "registration_number" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "fa_class_code" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "fa_subclass_code" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "bc_location_code" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "bc_dimension1_code" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "bc_product_no" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "bc_service_item_no" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "is_blocked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "is_inactive" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "is_disposed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "is_on_rent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "is_in_service" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "under_maintenance" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "book_value" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "source_payload" jsonb;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "source_payload" jsonb;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "responsibility_center" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_sales_team" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_deal_code" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "damage_waiver_declined" boolean;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "insurance_cert_required" boolean;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "insurance_expiration_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "insurance_policy_no" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "registration_number" text;
--> statement-breakpoint
ALTER TABLE "customer_locations" ADD COLUMN IF NOT EXISTS "source_payload" jsonb;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_search_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "href" text NOT NULL,
  "branch_id" text REFERENCES "public"."branches"("id"),
  "search_text" text NOT NULL,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "global_search_documents_entity_unique" ON "global_search_documents" USING btree ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "global_search_documents_entity_branch_idx" ON "global_search_documents" USING btree ("entity_type", "branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "global_search_documents_search_text_trgm_idx" ON "global_search_documents" USING gin ("search_text" gin_trgm_ops);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "agreement_kind" "agreement_kind" DEFAULT 'rental_order' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "legacy_source_system" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "legacy_document_no" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "legacy_previous_document_no" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "legacy_previous_document_type" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "service_branch_id" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "service_location_code" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "agreement_state" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "import_completeness" "import_completeness";
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "legacy_opened_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "legacy_closed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "posted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "source_provider" "integration_provider";
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "source_document_type" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "source_document_no" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "source_status" text;
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "line_kind" "contract_line_kind";
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_line_type" text;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_sequence_no" integer;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_deal_code" text;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_deal_length" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "billing_for" text;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "invoice_from_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "invoice_thru_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "shipment_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "return_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "tax_group_code" text;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "damage_waiver_percent" numeric(8, 4);
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "parent_item_line_no" integer;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "legacy_posting_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_line_no" integer;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_item_no" text;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_uom_code" text;
--> statement-breakpoint
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "legacy_invoice_no" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "legacy_order_no" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_source_kind" "invoice_source_kind" DEFAULT 'app_native' NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "import_completeness" "import_completeness";
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "posting_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "responsibility_center" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "dimension_set_id" integer;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_provider" "integration_provider";
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_document_type" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_document_no" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_status" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.commercial_events') IS NULL AND to_regclass('public.financial_events') IS NOT NULL THEN
    ALTER TABLE "financial_events" RENAME TO "commercial_events";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER INDEX IF EXISTS "financial_events_contract_status_idx" RENAME TO "commercial_events_contract_status_idx";
  ALTER INDEX IF EXISTS "financial_events_asset_id_idx" RENAME TO "commercial_events_asset_id_idx";
  ALTER INDEX IF EXISTS "financial_events_work_order_id_idx" RENAME TO "commercial_events_work_order_id_idx";
  ALTER INDEX IF EXISTS "financial_events_invoice_id_idx" RENAME TO "commercial_events_invoice_id_idx";
  ALTER INDEX IF EXISTS "financial_events_event_date_idx" RENAME TO "commercial_events_event_date_idx";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commercial_events" (
  "id" text PRIMARY KEY NOT NULL,
  "contract_id" text,
  "contract_line_id" text,
  "asset_id" text,
  "work_order_id" text,
  "invoice_id" text,
  "event_type" "financial_event_type" NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "event_date" timestamp with time zone NOT NULL,
  "status" "financial_event_status" DEFAULT 'pending' NOT NULL,
  "external_reference" text,
  "source_document_type" text,
  "source_document_no" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "service_period_start" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "service_period_end" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "service_branch_id" text;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "service_location_code" text;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "customer_location_id" text;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "legacy_order_no" text;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "legacy_invoice_no" text;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "legacy_line_no" integer;
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "revenue_recognition_basis" "revenue_recognition_basis";
--> statement-breakpoint
ALTER TABLE "commercial_events" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "contract_line_id" text;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "asset_id" text;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "line_kind" "contract_line_kind";
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "service_period_start" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "service_period_end" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "legacy_deal_code" text;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "tax_group_code" text;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "source_sequence_no" integer;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "source_line_no" integer;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "source_item_no" text;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "source_uom_code" text;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_import_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" "integration_provider" DEFAULT 'business_central' NOT NULL,
  "entity_type" text NOT NULL,
  "status" "bc_import_run_status" DEFAULT 'pending' NOT NULL,
  "source_window_start" timestamp with time zone,
  "source_window_end" timestamp with time zone,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "records_seen" integer DEFAULT 0 NOT NULL,
  "records_inserted" integer DEFAULT 0 NOT NULL,
  "records_updated" integer DEFAULT 0 NOT NULL,
  "records_skipped" integer DEFAULT 0 NOT NULL,
  "records_failed" integer DEFAULT 0 NOT NULL,
  "error_summary" text,
  "job_version" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_import_runs_status_idx" ON "bc_import_runs" USING btree ("entity_type", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_import_runs_started_at_idx" ON "bc_import_runs" USING btree ("started_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_import_errors" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "bc_import_runs"("id") ON DELETE cascade,
  "entity_type" text NOT NULL,
  "external_id" text,
  "internal_id" text,
  "page_cursor" text,
  "error_code" text,
  "message" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_import_errors_run_idx" ON "bc_import_errors" USING btree ("run_id", "entity_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_import_checkpoints" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "cursor" text,
  "page_number" integer DEFAULT 0 NOT NULL,
  "last_external_id" text,
  "window_start" timestamp with time zone,
  "window_end" timestamp with time zone,
  "checkpoint_data" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bc_import_checkpoints_entity_type_unique" UNIQUE ("entity_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_source_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "external_document_id" text NOT NULL,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "customer_external_id" text,
  "status" text,
  "document_date" timestamp with time zone,
  "due_date" timestamp with time zone,
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_source_documents_external_unique" ON "bc_source_documents" USING btree ("document_type", "external_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_source_documents_document_no_idx" ON "bc_source_documents" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_source_document_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "source_document_id" text NOT NULL REFERENCES "bc_source_documents"("id") ON DELETE cascade,
  "external_line_id" text,
  "line_no" integer,
  "item_no" text,
  "uom_code" text,
  "quantity" numeric(12, 2),
  "unit_price" numeric(12, 2),
  "line_amount" numeric(12, 2),
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_source_document_lines_document_idx" ON "bc_source_document_lines" USING btree ("source_document_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_customer_cards" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "customer_no" text NOT NULL,
  "name" text NOT NULL,
  "customer_type" text,
  "parent_no" text,
  "parent_name" text,
  "blocked" text,
  "responsibility_center" text,
  "salesperson_code" text,
  "default_sales_team" text,
  "default_deal_code" text,
  "damage_waiver_declined" boolean,
  "insurance_cert_required" boolean,
  "insurance_expiration_date" timestamp with time zone,
  "insurance_policy_no" text,
  "registration_number" text,
  "balance_lcy" numeric(14, 2),
  "balance_due_lcy" numeric(14, 2),
  "credit_limit_lcy" numeric(14, 2),
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_customer_cards_no_unique" ON "bc_customer_cards" USING btree ("customer_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_customer_cards_parent_idx" ON "bc_customer_cards" USING btree ("parent_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_rmi_posted_rental_headers" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "external_id" text,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "previous_doc_type" text,
  "previous_no" text,
  "sell_to_customer_no" text,
  "bill_to_customer_no" text,
  "ship_to_code" text,
  "posting_date" timestamp with time zone,
  "order_date" timestamp with time zone,
  "select_thru_date" timestamp with time zone,
  "document_date" timestamp with time zone,
  "due_date" timestamp with time zone,
  "shipment_date" timestamp with time zone,
  "return_date" timestamp with time zone,
  "location_code" text,
  "responsibility_center" text,
  "shortcut_dimension1_code" text,
  "shortcut_dimension2_code" text,
  "status" text,
  "source_code" text,
  "external_document_no" text,
  "dimension_set_id" integer,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_prh_doc_unique" ON "bc_rmi_posted_rental_headers" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prh_previous_idx" ON "bc_rmi_posted_rental_headers" USING btree ("previous_doc_type", "previous_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prh_customer_idx" ON "bc_rmi_posted_rental_headers" USING btree ("bill_to_customer_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_rmi_posted_rental_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "external_id" text,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "line_no" integer NOT NULL,
  "sequence_no" integer,
  "line_type" text,
  "type" text,
  "item_no" text,
  "description" text,
  "quantity" numeric(14, 4),
  "unit_of_measure_code" text,
  "unit_price" numeric(14, 2),
  "gross_amount" numeric(14, 2),
  "gross_amount_lcy" numeric(14, 2),
  "line_discount_amount" numeric(14, 2),
  "invoice_discount_amount" numeric(14, 2),
  "tax_amount" numeric(14, 2),
  "damage_waiver_amount" numeric(14, 2),
  "from_date" timestamp with time zone,
  "thru_date" timestamp with time zone,
  "invoice_from_date" timestamp with time zone,
  "invoice_thru_date" timestamp with time zone,
  "shipment_date" timestamp with time zone,
  "return_date" timestamp with time zone,
  "posting_date" timestamp with time zone,
  "previous_doc_type" text,
  "previous_no" text,
  "deal_code" text,
  "deal_length" numeric(10, 2),
  "billing_for" text,
  "location_code" text,
  "shortcut_dimension1_code" text,
  "shortcut_dimension2_code" text,
  "tax_group_code" text,
  "dimension_set_id" integer,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_prl_line_unique" ON "bc_rmi_posted_rental_lines" USING btree ("document_type", "document_no", "line_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_previous_idx" ON "bc_rmi_posted_rental_lines" USING btree ("previous_doc_type", "previous_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_asset_idx" ON "bc_rmi_posted_rental_lines" USING btree ("type", "item_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_rmi_rental_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "external_entry_no" text NOT NULL,
  "document_type" text,
  "document_no" text,
  "order_no" text,
  "posting_date" timestamp with time zone,
  "bill_to_customer_no" text,
  "type_ordered" text,
  "no_ordered" text,
  "type_shipped" text,
  "no_shipped" text,
  "serial_no_shipped" text,
  "quantity" numeric(14, 4),
  "from_date" timestamp with time zone,
  "thru_date" timestamp with time zone,
  "rental_days" numeric(14, 4),
  "unit_price" numeric(14, 2),
  "gross_amount" numeric(14, 2),
  "gross_amount_lcy" numeric(14, 2),
  "line_discount_amount" numeric(14, 2),
  "invoice_discount_amount" numeric(14, 2),
  "deal_code" text,
  "shortcut_dimension1_code" text,
  "shortcut_dimension2_code" text,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_rle_entry_unique" ON "bc_rmi_rental_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_rle_document_idx" ON "bc_rmi_rental_ledger_entries" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_rle_order_idx" ON "bc_rmi_rental_ledger_entries" USING btree ("order_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_rmi_posted_rental_invoice_headers" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "previous_doc_type" text,
  "previous_no" text,
  "sell_to_customer_no" text,
  "bill_to_customer_no" text,
  "posting_date" timestamp with time zone,
  "document_date" timestamp with time zone,
  "due_date" timestamp with time zone,
  "location_code" text,
  "responsibility_center" text,
  "shortcut_dimension1_code" text,
  "shortcut_dimension2_code" text,
  "external_document_no" text,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_doc_unique" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_previous_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("previous_doc_type", "previous_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_sales_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "external_id" text,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "sell_to_customer_no" text,
  "bill_to_customer_no" text,
  "status" text,
  "order_date" timestamp with time zone,
  "posting_date" timestamp with time zone,
  "document_date" timestamp with time zone,
  "due_date" timestamp with time zone,
  "shipment_date" timestamp with time zone,
  "location_code" text,
  "shortcut_dimension1_code" text,
  "shortcut_dimension2_code" text,
  "amount" numeric(14, 2),
  "amount_including_vat" numeric(14, 2),
  "dimension_set_id" integer,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_sales_documents_doc_unique" ON "bc_sales_documents" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_sales_documents_customer_idx" ON "bc_sales_documents" USING btree ("sell_to_customer_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_sales_document_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "line_no" integer NOT NULL,
  "sell_to_customer_no" text,
  "type" text,
  "item_no" text,
  "description" text,
  "quantity" numeric(14, 4),
  "outstanding_quantity" numeric(14, 4),
  "qty_to_invoice" numeric(14, 4),
  "unit_price" numeric(14, 2),
  "amount" numeric(14, 2),
  "line_amount" numeric(14, 2),
  "amount_including_vat" numeric(14, 2),
  "location_code" text,
  "shipment_date" timestamp with time zone,
  "requested_delivery_date" timestamp with time zone,
  "planned_delivery_date" timestamp with time zone,
  "shortcut_dimension1_code" text,
  "shortcut_dimension2_code" text,
  "dimension_set_id" integer,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_sales_doc_lines_unique" ON "bc_sales_document_lines" USING btree ("document_type", "document_no", "line_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_sales_doc_lines_document_idx" ON "bc_sales_document_lines" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_rmi_posted_rental_invoice_rental_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "line_no" integer NOT NULL,
  "item_no" text,
  "description" text,
  "quantity" numeric(14, 4),
  "unit_price" numeric(14, 2),
  "line_amount" numeric(14, 2),
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_inv_rent_lines_unique" ON "bc_rmi_posted_rental_invoice_rental_lines" USING btree ("document_type", "document_no", "line_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_rmi_posted_rental_invoice_sales_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "document_type" text NOT NULL,
  "document_no" text NOT NULL,
  "line_no" integer NOT NULL,
  "item_no" text,
  "description" text,
  "quantity" numeric(14, 4),
  "unit_price" numeric(14, 2),
  "line_amount" numeric(14, 2),
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_inv_sale_lines_unique" ON "bc_rmi_posted_rental_invoice_sales_lines" USING btree ("document_type", "document_no", "line_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_gl_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "account_no" text NOT NULL,
  "name" text NOT NULL,
  "account_type" text,
  "income_balance" text,
  "category" text,
  "subcategory" text,
  "blocked" boolean DEFAULT false NOT NULL,
  "payload" jsonb,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_gl_accounts_account_no_unique" ON "bc_gl_accounts" USING btree ("account_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_vendors" (
  "id" text PRIMARY KEY NOT NULL,
  "vendor_no" text NOT NULL,
  "name" text NOT NULL,
  "status" text,
  "location_code" text,
  "payload" jsonb,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_vendors_vendor_no_unique" ON "bc_vendors" USING btree ("vendor_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_dimension_sets" (
  "id" text PRIMARY KEY NOT NULL,
  "external_dimension_set_id" text NOT NULL,
  "payload" jsonb,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_dimension_set_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "dimension_set_id" text NOT NULL REFERENCES "bc_dimension_sets"("id") ON DELETE cascade,
  "dimension_code" text NOT NULL,
  "dimension_value_code" text NOT NULL,
  "payload" jsonb,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_gl_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "external_entry_no" text NOT NULL,
  "posting_date" timestamp with time zone,
  "document_no" text,
  "description" text,
  "account_no" text,
  "amount" numeric(14, 2),
  "debit_amount" numeric(14, 2),
  "credit_amount" numeric(14, 2),
  "dimension_set_id" text REFERENCES "bc_dimension_sets"("id"),
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_gl_entries_external_entry_no_unique" ON "bc_gl_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_gl_entries_posting_date_idx" ON "bc_gl_entries" USING btree ("posting_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_bank_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "external_entry_no" text NOT NULL,
  "bank_account_no" text,
  "posting_date" timestamp with time zone,
  "document_no" text,
  "amount" numeric(14, 2),
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_bank_ledger_entries_external_entry_no_unique" ON "bc_bank_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_vendor_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "external_entry_no" text NOT NULL,
  "vendor_no" text,
  "posting_date" timestamp with time zone,
  "document_no" text,
  "amount" numeric(14, 2),
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_vendor_ledger_entries_external_entry_no_unique" ON "bc_vendor_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_customer_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "external_entry_no" text NOT NULL,
  "customer_no" text,
  "posting_date" timestamp with time zone,
  "document_no" text,
  "amount" numeric(14, 2),
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_customer_ledger_entries_external_entry_no_unique" ON "bc_customer_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bc_fa_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "external_entry_no" text NOT NULL,
  "asset_no" text,
  "posting_date" timestamp with time zone,
  "document_no" text,
  "amount" numeric(14, 2),
  "payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_fa_ledger_entries_external_entry_no_unique" ON "bc_fa_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "account_number" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "subcategory" text,
  "normal_side" "journal_line_side" NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "source_provider" "integration_provider",
  "source_external_id" text,
  "source_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_accounts_account_number_unique" ON "gl_accounts" USING btree ("account_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_posting_periods" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_posting_periods_range_unique" ON "gl_posting_periods" USING btree ("starts_at", "ends_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_dimensions" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_dimensions_code_unique" ON "gl_dimensions" USING btree ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_dimension_values" (
  "id" text PRIMARY KEY NOT NULL,
  "dimension_id" text NOT NULL REFERENCES "gl_dimensions"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_dimension_values_dimension_code_unique" ON "gl_dimension_values" USING btree ("dimension_id", "code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_journal_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" "journal_entry_status" DEFAULT 'draft' NOT NULL,
  "source" text,
  "created_by_user_id" text REFERENCES "users"("id"),
  "posted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_journal_batches_name_unique" ON "gl_journal_batches" USING btree ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_journal_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "batch_id" text REFERENCES "gl_journal_batches"("id"),
  "posting_period_id" text REFERENCES "gl_posting_periods"("id"),
  "entry_number" text NOT NULL,
  "entry_date" timestamp with time zone NOT NULL,
  "source_type" text,
  "source_id" text,
  "description" text NOT NULL,
  "status" "journal_entry_status" DEFAULT 'draft' NOT NULL,
  "currency_code" text DEFAULT 'USD' NOT NULL,
  "posted_at" timestamp with time zone,
  "reversal_of_entry_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_journal_entries_entry_number_unique" ON "gl_journal_entries" USING btree ("entry_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gl_journal_entries_status_idx" ON "gl_journal_entries" USING btree ("status", "entry_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_journal_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "journal_entry_id" text NOT NULL REFERENCES "gl_journal_entries"("id") ON DELETE cascade,
  "line_no" integer NOT NULL,
  "account_id" text NOT NULL REFERENCES "gl_accounts"("id"),
  "side" "journal_line_side" NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "description" text,
  "customer_id" text REFERENCES "customers"("id"),
  "vendor_id" text REFERENCES "bc_vendors"("id"),
  "asset_id" text REFERENCES "assets"("id"),
  "contract_id" text REFERENCES "contracts"("id"),
  "branch_id" text REFERENCES "branches"("id"),
  "source_document_type" text,
  "source_document_no" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_journal_lines_journal_line_unique" ON "gl_journal_lines" USING btree ("journal_entry_id", "line_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gl_journal_lines_account_idx" ON "gl_journal_lines" USING btree ("account_id", "side");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_entry_dimensions" (
  "id" text PRIMARY KEY NOT NULL,
  "journal_line_id" text NOT NULL REFERENCES "gl_journal_lines"("id") ON DELETE cascade,
  "dimension_id" text NOT NULL REFERENCES "gl_dimensions"("id"),
  "dimension_value_id" text NOT NULL REFERENCES "gl_dimension_values"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_entry_dimensions_line_dimension_unique" ON "gl_entry_dimensions" USING btree ("journal_line_id", "dimension_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posting_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "scope" "posting_rule_scope" NOT NULL,
  "event_type" text,
  "active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "posting_rules_code_unique" ON "posting_rules" USING btree ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posting_rule_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "posting_rule_id" text NOT NULL REFERENCES "posting_rules"("id") ON DELETE cascade,
  "line_role" text NOT NULL,
  "account_id" text NOT NULL REFERENCES "gl_accounts"("id"),
  "amount_mode" text DEFAULT 'event_amount' NOT NULL,
  "memo_template" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "posting_rule_lines_rule_sort_unique" ON "posting_rule_lines" USING btree ("posting_rule_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ar_credit_memos" (
  "id" text PRIMARY KEY NOT NULL,
  "credit_memo_number" text NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customers"("id"),
  "contract_id" text REFERENCES "contracts"("id"),
  "status" "subledger_document_status" DEFAULT 'draft' NOT NULL,
  "credit_memo_date" timestamp with time zone NOT NULL,
  "total_amount" numeric(12, 2) NOT NULL,
  "balance_amount" numeric(12, 2) NOT NULL,
  "source_provider" "integration_provider",
  "source_document_no" text,
  "source_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ar_credit_memos_number_unique" ON "ar_credit_memos" USING btree ("credit_memo_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ar_receipts" (
  "id" text PRIMARY KEY NOT NULL,
  "receipt_number" text NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customers"("id"),
  "cash_account_id" text,
  "status" "subledger_document_status" DEFAULT 'draft' NOT NULL,
  "receipt_date" timestamp with time zone NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "unapplied_amount" numeric(12, 2) NOT NULL,
  "source_provider" "integration_provider",
  "source_document_no" text,
  "source_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ar_receipts_number_unique" ON "ar_receipts" USING btree ("receipt_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ar_applications" (
  "id" text PRIMARY KEY NOT NULL,
  "receipt_id" text NOT NULL REFERENCES "ar_receipts"("id") ON DELETE cascade,
  "invoice_id" text REFERENCES "invoices"("id"),
  "credit_memo_id" text REFERENCES "ar_credit_memos"("id"),
  "applied_amount" numeric(12, 2) NOT NULL,
  "applied_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_applications_receipt_id_idx" ON "ar_applications" USING btree ("receipt_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "account_number" text NOT NULL,
  "name" text NOT NULL,
  "gl_account_id" text REFERENCES "gl_accounts"("id"),
  "active" boolean DEFAULT true NOT NULL,
  "source_provider" "integration_provider",
  "source_external_id" text,
  "source_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_accounts_account_number_unique" ON "cash_accounts" USING btree ("account_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "cash_account_id" text NOT NULL REFERENCES "cash_accounts"("id"),
  "ar_receipt_id" text REFERENCES "ar_receipts"("id"),
  "ap_payment_id" text,
  "transaction_type" "cash_transaction_type" NOT NULL,
  "transaction_date" timestamp with time zone NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "description" text,
  "source_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_transactions_cash_date_idx" ON "cash_transactions" USING btree ("cash_account_id", "transaction_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ap_bills" (
  "id" text PRIMARY KEY NOT NULL,
  "bill_number" text NOT NULL,
  "vendor_id" text NOT NULL REFERENCES "bc_vendors"("id"),
  "status" "subledger_document_status" DEFAULT 'draft' NOT NULL,
  "bill_date" timestamp with time zone NOT NULL,
  "due_date" timestamp with time zone,
  "total_amount" numeric(12, 2) NOT NULL,
  "balance_amount" numeric(12, 2) NOT NULL,
  "source_provider" "integration_provider",
  "source_document_no" text,
  "source_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ap_bills_number_unique" ON "ap_bills" USING btree ("bill_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ap_bill_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "bill_id" text NOT NULL REFERENCES "ap_bills"("id") ON DELETE cascade,
  "description" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "gl_account_id" text REFERENCES "gl_accounts"("id"),
  "asset_id" text REFERENCES "assets"("id"),
  "source_line_no" integer,
  "source_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ap_bill_lines_bill_id_idx" ON "ap_bill_lines" USING btree ("bill_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ap_payments" (
  "id" text PRIMARY KEY NOT NULL,
  "payment_number" text NOT NULL,
  "vendor_id" text NOT NULL REFERENCES "bc_vendors"("id"),
  "cash_account_id" text REFERENCES "cash_accounts"("id"),
  "status" "subledger_document_status" DEFAULT 'draft' NOT NULL,
  "payment_date" timestamp with time zone NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "unapplied_amount" numeric(12, 2) NOT NULL,
  "source_provider" "integration_provider",
  "source_document_no" text,
  "source_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ap_payments_number_unique" ON "ap_payments" USING btree ("payment_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ap_applications" (
  "id" text PRIMARY KEY NOT NULL,
  "payment_id" text NOT NULL REFERENCES "ap_payments"("id") ON DELETE cascade,
  "bill_id" text NOT NULL REFERENCES "ap_bills"("id") ON DELETE cascade,
  "applied_amount" numeric(12, 2) NOT NULL,
  "applied_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ap_applications_payment_id_idx" ON "ap_applications" USING btree ("payment_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fa_books" (
  "id" text PRIMARY KEY NOT NULL,
  "asset_id" text NOT NULL REFERENCES "assets"("id") ON DELETE cascade,
  "book_code" text NOT NULL,
  "acquisition_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
  "accumulated_depreciation" numeric(14, 2) DEFAULT '0' NOT NULL,
  "net_book_value" numeric(14, 2) DEFAULT '0' NOT NULL,
  "in_service_date" timestamp with time zone,
  "retired_at" timestamp with time zone,
  "source_provider" "integration_provider",
  "source_external_id" text,
  "source_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fa_books_asset_book_unique" ON "fa_books" USING btree ("asset_id", "book_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fa_postings" (
  "id" text PRIMARY KEY NOT NULL,
  "fa_book_id" text NOT NULL REFERENCES "fa_books"("id") ON DELETE cascade,
  "journal_entry_id" text REFERENCES "gl_journal_entries"("id"),
  "posting_type" text NOT NULL,
  "posting_date" timestamp with time zone NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "description" text,
  "source_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fa_postings_book_date_idx" ON "fa_postings" USING btree ("fa_book_id", "posting_date");
