CREATE TABLE IF NOT EXISTS "bc_rmi_ws_rental_ledger_entries" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "bc_rmi_ws_rle_entry_unique" ON "bc_rmi_ws_rental_ledger_entries" USING btree ("external_entry_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_ws_rle_document_idx" ON "bc_rmi_ws_rental_ledger_entries" USING btree ("document_type", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_ws_rle_order_idx" ON "bc_rmi_ws_rental_ledger_entries" USING btree ("order_no");
