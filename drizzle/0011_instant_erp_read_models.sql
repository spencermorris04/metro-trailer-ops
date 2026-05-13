CREATE TABLE IF NOT EXISTS "read_model_refresh_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "summary_version" text NOT NULL,
  "error_message" text,
  "row_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "timings_ms" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "read_model_refresh_runs_status_started_idx" ON "read_model_refresh_runs" USING btree ("status", "started_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_summary" (
  "asset_id" text PRIMARY KEY NOT NULL,
  "asset_number" text NOT NULL,
  "asset_type" text NOT NULL,
  "asset_subtype" text,
  "fa_class_code" text,
  "fa_subclass_code" text,
  "manufacturer" text,
  "model_year" integer,
  "serial_number" text,
  "registration_number" text,
  "branch_id" text,
  "branch_code" text,
  "branch_name" text,
  "status" text,
  "availability" text,
  "maintenance_status" text,
  "bc_location_code" text,
  "bc_dimension1_code" text,
  "bc_product_no" text,
  "bc_service_item_no" text,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "is_inactive" boolean DEFAULT false NOT NULL,
  "is_disposed" boolean DEFAULT false NOT NULL,
  "is_on_rent" boolean DEFAULT false NOT NULL,
  "is_in_service" boolean DEFAULT true NOT NULL,
  "under_maintenance" boolean DEFAULT false NOT NULL,
  "book_value" numeric(14, 2),
  "invoice_line_count" integer DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "lease_count" integer DEFAULT 0 NOT NULL,
  "lifetime_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "last12m_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "latest_invoice_no" text,
  "latest_lease_key" text,
  "latest_customer_no" text,
  "latest_customer_name" text,
  "latest_billed_from" timestamp with time zone,
  "latest_billed_thru" timestamp with time zone,
  "latest_activity_at" timestamp with time zone,
  "source_provider" "integration_provider",
  "source_payload_available" boolean DEFAULT false NOT NULL,
  "search_text" text NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_asset_number_idx" ON "equipment_summary" USING btree ("asset_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_activity_idx" ON "equipment_summary" USING btree ("latest_activity_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_type_branch_idx" ON "equipment_summary" USING btree ("asset_type", "branch_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_branch_activity_idx" ON "equipment_summary" USING btree ("branch_code", "latest_activity_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_summary" (
  "customer_id" text PRIMARY KEY NOT NULL,
  "customer_number" text NOT NULL,
  "name" text NOT NULL,
  "customer_type" text NOT NULL,
  "parent_customer_number" text,
  "responsibility_center" text,
  "blocked" boolean DEFAULT false NOT NULL,
  "portal_enabled" boolean DEFAULT false NOT NULL,
  "branch_coverage" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "billing_city" text,
  "location_count" integer DEFAULT 0 NOT NULL,
  "location_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "contract_count" integer DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "lease_count" integer DEFAULT 0 NOT NULL,
  "equipment_count" integer DEFAULT 0 NOT NULL,
  "lifetime_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "last12m_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "ar_balance" numeric(18, 2) DEFAULT 0 NOT NULL,
  "open_invoice_count" integer DEFAULT 0 NOT NULL,
  "last_invoice_date" timestamp with time zone,
  "last_activity_date" timestamp with time zone,
  "source_provider" "integration_provider",
  "source_payload_available" boolean DEFAULT false NOT NULL,
  "search_text" text NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_summary_customer_number_idx" ON "customer_summary" USING btree ("customer_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_summary_activity_idx" ON "customer_summary" USING btree ("last_activity_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_summary_type_activity_idx" ON "customer_summary" USING btree ("customer_type", "last_activity_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_register_summary" (
  "id" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "document_type" text,
  "document_no" text NOT NULL,
  "customer_number" text,
  "customer_name" text,
  "previous_no" text,
  "previous_document_type" text,
  "posting_date" timestamp with time zone,
  "due_date" timestamp with time zone,
  "status" text NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "fixed_asset_line_count" integer DEFAULT 0 NOT NULL,
  "equipment_count" integer DEFAULT 0 NOT NULL,
  "gross_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "tax_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "damage_waiver_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "total_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "ar_balance" numeric(18, 2),
  "latest_activity_at" timestamp with time zone,
  "amount_source" text NOT NULL,
  "search_text" text NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_register_summary_source_doc_unique" ON "invoice_register_summary" USING btree ("source", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_register_summary_activity_idx" ON "invoice_register_summary" USING btree ("posting_date", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_register_summary_customer_activity_idx" ON "invoice_register_summary" USING btree ("customer_number", "posting_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_register_summary_previous_activity_idx" ON "invoice_register_summary" USING btree ("previous_no", "posting_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lease_summary" (
  "lease_key" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "customer_number" text,
  "customer_name" text,
  "first_invoice_date" timestamp with time zone,
  "latest_invoice_date" timestamp with time zone,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "equipment_count" integer DEFAULT 0 NOT NULL,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "latest_activity_at" timestamp with time zone,
  "status" text NOT NULL,
  "search_text" text NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_summary_activity_idx" ON "lease_summary" USING btree ("latest_invoice_date", "lease_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_summary_customer_activity_idx" ON "lease_summary" USING btree ("customer_number", "latest_invoice_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_dashboard_snapshot" (
  "snapshot_key" text PRIMARY KEY NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "tax_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "damage_waiver_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "credit_memo_count" integer DEFAULT 0 NOT NULL,
  "equipment_count" integer DEFAULT 0 NOT NULL,
  "lease_count" integer DEFAULT 0 NOT NULL,
  "ar_balance" numeric(18, 2) DEFAULT 0 NOT NULL,
  "open_ar_balance" numeric(18, 2) DEFAULT 0 NOT NULL,
  "unapplied_receipts" numeric(18, 2) DEFAULT 0 NOT NULL,
  "revenue_by_month" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revenue_by_equipment_type" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revenue_by_branch" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revenue_by_customer" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revenue_by_lease" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revenue_by_deal_code" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ar_aging" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "recent_activity" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "exceptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_row_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_rollup_monthly" (
  "month" timestamp with time zone PRIMARY KEY NOT NULL,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "tax_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "damage_waiver_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "equipment_count" integer DEFAULT 0 NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_revenue_rollup_monthly" (
  "id" text PRIMARY KEY NOT NULL,
  "month" timestamp with time zone NOT NULL,
  "asset_number" text NOT NULL,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_revenue_rollup_asset_month_unique" ON "equipment_revenue_rollup_monthly" USING btree ("asset_number", "month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_revenue_rollup_month_idx" ON "equipment_revenue_rollup_monthly" USING btree ("month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_revenue_rollup_monthly" (
  "id" text PRIMARY KEY NOT NULL,
  "month" timestamp with time zone NOT NULL,
  "customer_number" text NOT NULL,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "equipment_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_revenue_rollup_customer_month_unique" ON "customer_revenue_rollup_monthly" USING btree ("customer_number", "month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_revenue_rollup_month_idx" ON "customer_revenue_rollup_monthly" USING btree ("month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branch_revenue_rollup_monthly" (
  "id" text PRIMARY KEY NOT NULL,
  "month" timestamp with time zone NOT NULL,
  "branch_code" text NOT NULL,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branch_revenue_rollup_branch_month_unique" ON "branch_revenue_rollup_monthly" USING btree ("branch_code", "month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_revenue_rollup_month_idx" ON "branch_revenue_rollup_monthly" USING btree ("month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_code_revenue_rollup_monthly" (
  "id" text PRIMARY KEY NOT NULL,
  "month" timestamp with time zone NOT NULL,
  "deal_code" text NOT NULL,
  "gross_revenue" numeric(18, 2) DEFAULT 0 NOT NULL,
  "invoice_count" integer DEFAULT 0 NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deal_code_revenue_rollup_deal_month_unique" ON "deal_code_revenue_rollup_monthly" USING btree ("deal_code", "month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deal_code_revenue_rollup_month_idx" ON "deal_code_revenue_rollup_monthly" USING btree ("month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ar_customer_summary" (
  "customer_number" text PRIMARY KEY NOT NULL,
  "ar_balance" numeric(18, 2) DEFAULT 0 NOT NULL,
  "open_invoice_count" integer DEFAULT 0 NOT NULL,
  "entry_count" integer DEFAULT 0 NOT NULL,
  "latest_posting_date" timestamp with time zone,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_customer_summary_balance_idx" ON "ar_customer_summary" USING btree ("ar_balance");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_customer_summary_activity_idx" ON "ar_customer_summary" USING btree ("latest_posting_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ar_aging_snapshot" (
  "bucket" text PRIMARY KEY NOT NULL,
  "balance" numeric(18, 2) DEFAULT 0 NOT NULL,
  "entry_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_asset_activity_idx" ON "bc_rmi_posted_rental_lines" USING btree ("type", "item_no", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_document_idx" ON "bc_rmi_posted_rental_lines" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_previous_activity_idx" ON "bc_rmi_posted_rental_lines" USING btree ("previous_no", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_deal_activity_idx" ON "bc_rmi_posted_rental_lines" USING btree ("deal_code", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_location_activity_idx" ON "bc_rmi_posted_rental_lines" USING btree ("location_code", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_prl_dimension1_activity_idx" ON "bc_rmi_posted_rental_lines" USING btree ("shortcut_dimension1_code", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_bill_to_activity_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("bill_to_customer_no", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_sell_to_activity_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("sell_to_customer_no", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_previous_activity_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("previous_no", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_activity_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("posting_date" DESC, "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_customer_ledger_customer_activity_idx" ON "bc_customer_ledger_entries" USING btree ("customer_no", "posting_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_customer_ledger_document_idx" ON "bc_customer_ledger_entries" USING btree ("document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_customer_ledger_customer_document_idx" ON "bc_customer_ledger_entries" USING btree ("customer_no", "document_no");
