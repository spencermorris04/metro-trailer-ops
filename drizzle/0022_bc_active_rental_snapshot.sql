CREATE TABLE IF NOT EXISTS "bc_web_portal_ship_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text REFERENCES "bc_import_runs"("id") ON DELETE set null,
  "external_entry_no" text NOT NULL,
  "posting_date" timestamp with time zone,
  "transaction_type" text,
  "type" text,
  "asset_number" text,
  "location_code" text,
  "quantity" numeric(14, 4),
  "quantity_remaining" numeric(14, 4),
  "open" boolean,
  "document_type" text,
  "document_no" text,
  "rental_line_type" text,
  "sell_to_customer_no" text,
  "customer_type" text,
  "parent_no" text,
  "sell_to_customer_name" text,
  "ship_to_city" text,
  "ship_to_county" text,
  "ship_to_post_code" text,
  "ship_to_address" text,
  "description" text,
  "show_open" text,
  "source_payload" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bc_web_portal_sle_entry_unique"
  ON "bc_web_portal_ship_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_web_portal_sle_active_idx"
  ON "bc_web_portal_ship_ledger_entries" USING btree (
    "open",
    "type",
    "sell_to_customer_no",
    "asset_number"
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_web_portal_sle_document_idx"
  ON "bc_web_portal_ship_ledger_entries" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_web_portal_sle_asset_idx"
  ON "bc_web_portal_ship_ledger_entries" USING btree ("asset_number");
