CREATE TABLE IF NOT EXISTS rental_billing_facts (
  id text PRIMARY KEY,
  source_provider text NOT NULL,
  source_row_id text NOT NULL,
  document_type text,
  document_no text NOT NULL,
  line_no integer NOT NULL,
  line_key text NOT NULL,
  lease_key text,
  customer_number text,
  customer_id text,
  customer_name text,
  asset_number text,
  asset_id text,
  asset_type text,
  branch_code text,
  location_code text,
  deal_code text,
  posting_date timestamptz,
  service_period_start timestamptz,
  service_period_end timestamptz,
  line_kind text,
  description text,
  quantity numeric(14,4),
  unit_price numeric(14,2),
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  tax_amount numeric(18,2) NOT NULL DEFAULT 0,
  damage_waiver_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  source_imported_at timestamptz,
  source_updated_at timestamptz,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_billing_facts_source_row_unique
  ON rental_billing_facts (source_provider, source_row_id);
CREATE INDEX IF NOT EXISTS rental_billing_facts_asset_activity_idx
  ON rental_billing_facts (asset_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_billing_facts_customer_activity_idx
  ON rental_billing_facts (customer_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_billing_facts_lease_activity_idx
  ON rental_billing_facts (lease_key, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_billing_facts_invoice_line_idx
  ON rental_billing_facts (document_no, line_no);
CREATE INDEX IF NOT EXISTS rental_billing_facts_posting_idx
  ON rental_billing_facts (posting_date);
CREATE INDEX IF NOT EXISTS rental_billing_facts_branch_posting_idx
  ON rental_billing_facts (branch_code, posting_date);
CREATE INDEX IF NOT EXISTS rental_billing_facts_deal_posting_idx
  ON rental_billing_facts (deal_code, posting_date);
CREATE INDEX IF NOT EXISTS rental_billing_facts_asset_type_posting_idx
  ON rental_billing_facts (asset_type, posting_date);

CREATE TABLE IF NOT EXISTS rental_invoice_facts (
  id text PRIMARY KEY,
  source_provider text NOT NULL,
  source_row_id text NOT NULL,
  document_type text,
  document_no text NOT NULL,
  lease_key text,
  previous_document_type text,
  customer_number text,
  customer_id text,
  customer_name text,
  posting_date timestamptz,
  document_date timestamptz,
  due_date timestamptz,
  branch_code text,
  responsibility_center text,
  line_count integer NOT NULL DEFAULT 0,
  fixed_asset_line_count integer NOT NULL DEFAULT 0,
  equipment_count integer NOT NULL DEFAULT 0,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  tax_amount numeric(18,2) NOT NULL DEFAULT 0,
  damage_waiver_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  ar_balance numeric(18,2),
  status text NOT NULL,
  source_imported_at timestamptz,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_invoice_facts_source_row_unique
  ON rental_invoice_facts (source_provider, source_row_id);
CREATE UNIQUE INDEX IF NOT EXISTS rental_invoice_facts_source_doc_unique
  ON rental_invoice_facts (source_provider, document_no);
CREATE INDEX IF NOT EXISTS rental_invoice_facts_customer_activity_idx
  ON rental_invoice_facts (customer_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_invoice_facts_lease_activity_idx
  ON rental_invoice_facts (lease_key, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_invoice_facts_activity_idx
  ON rental_invoice_facts (posting_date DESC, document_no);

CREATE TABLE IF NOT EXISTS ar_ledger_facts (
  id text PRIMARY KEY,
  source_provider text NOT NULL,
  source_row_id text NOT NULL,
  external_entry_no text NOT NULL,
  customer_number text,
  customer_id text,
  customer_name text,
  posting_date timestamptz,
  document_no text,
  document_type text,
  description text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(18,2) NOT NULL DEFAULT 0,
  is_open boolean NOT NULL DEFAULT false,
  due_date timestamptz,
  source_imported_at timestamptz,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ar_ledger_facts_source_row_unique
  ON ar_ledger_facts (source_provider, source_row_id);
CREATE INDEX IF NOT EXISTS ar_ledger_facts_customer_activity_idx
  ON ar_ledger_facts (customer_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS ar_ledger_facts_document_idx
  ON ar_ledger_facts (document_no);

CREATE TABLE IF NOT EXISTS entity_activity_facts (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  related_entity_type text,
  related_entity_id text,
  activity_type text NOT NULL,
  activity_at timestamptz,
  title text NOT NULL,
  subtitle text,
  amount numeric(18,2),
  href text,
  source_provider text,
  source_row_id text,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_activity_facts_entity_activity_idx
  ON entity_activity_facts (entity_type, entity_id, activity_at DESC);
CREATE INDEX IF NOT EXISTS entity_activity_facts_related_idx
  ON entity_activity_facts (related_entity_type, related_entity_id, activity_at DESC);

CREATE TABLE IF NOT EXISTS projection_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  source_table text NOT NULL,
  source_id text NOT NULL,
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS projection_events_status_created_idx
  ON projection_events (status, created_at);
CREATE INDEX IF NOT EXISTS projection_events_source_idx
  ON projection_events (source_table, source_id);

CREATE TABLE IF NOT EXISTS projection_watermarks (
  projection_name text PRIMARY KEY,
  last_event_id text,
  last_processed_at timestamptz,
  projection_version text NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'idle',
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_detail_summary (
  asset_id text PRIMARY KEY,
  asset_number text NOT NULL,
  asset_type text NOT NULL,
  asset_subtype text,
  branch_code text,
  branch_name text,
  status text,
  availability text,
  maintenance_status text,
  serial_number text,
  manufacturer text,
  model_year integer,
  registration_number text,
  fa_class_code text,
  fa_subclass_code text,
  bc_location_code text,
  bc_dimension1_code text,
  bc_product_no text,
  bc_service_item_no text,
  is_blocked boolean NOT NULL DEFAULT false,
  is_inactive boolean NOT NULL DEFAULT false,
  is_disposed boolean NOT NULL DEFAULT false,
  is_on_rent boolean NOT NULL DEFAULT false,
  is_in_service boolean NOT NULL DEFAULT true,
  under_maintenance boolean NOT NULL DEFAULT false,
  book_value numeric(14,2),
  invoice_line_count integer NOT NULL DEFAULT 0,
  invoice_count integer NOT NULL DEFAULT 0,
  lease_count integer NOT NULL DEFAULT 0,
  lifetime_revenue numeric(18,2) NOT NULL DEFAULT 0,
  first_billed_at timestamptz,
  latest_billed_at timestamptz,
  latest_invoice_no text,
  latest_lease_key text,
  latest_customer_no text,
  latest_customer_name text,
  source_provider text,
  source_external_id text,
  source_payload_available boolean NOT NULL DEFAULT false,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_detail_summary_asset_number_idx
  ON equipment_detail_summary (asset_number);
CREATE INDEX IF NOT EXISTS equipment_detail_summary_activity_idx
  ON equipment_detail_summary (latest_billed_at DESC);

CREATE TABLE IF NOT EXISTS customer_detail_summary (
  customer_id text PRIMARY KEY,
  customer_number text NOT NULL,
  name text NOT NULL,
  customer_type text NOT NULL,
  parent_customer_number text,
  responsibility_center text,
  billing_city text,
  portal_enabled boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_count integer NOT NULL DEFAULT 0,
  invoice_count integer NOT NULL DEFAULT 0,
  lease_count integer NOT NULL DEFAULT 0,
  equipment_count integer NOT NULL DEFAULT 0,
  lifetime_revenue numeric(18,2) NOT NULL DEFAULT 0,
  tax_amount numeric(18,2) NOT NULL DEFAULT 0,
  damage_waiver_amount numeric(18,2) NOT NULL DEFAULT 0,
  ar_balance numeric(18,2) NOT NULL DEFAULT 0,
  first_invoice_date timestamptz,
  latest_invoice_date timestamptz,
  latest_activity_date timestamptz,
  source_provider text,
  source_external_id text,
  source_payload_available boolean NOT NULL DEFAULT false,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_detail_summary_number_idx
  ON customer_detail_summary (customer_number);
CREATE INDEX IF NOT EXISTS customer_detail_summary_activity_idx
  ON customer_detail_summary (latest_activity_date DESC);

CREATE TABLE IF NOT EXISTS equipment_customer_history (
  id text PRIMARY KEY,
  asset_id text,
  asset_number text NOT NULL,
  customer_id text,
  customer_number text,
  customer_name text,
  lease_key text,
  latest_invoice_no text,
  first_billed_at timestamptz,
  latest_billed_at timestamptz,
  invoice_count integer NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_customer_history_asset_idx
  ON equipment_customer_history (asset_number, latest_billed_at DESC);
CREATE INDEX IF NOT EXISTS equipment_customer_history_customer_idx
  ON equipment_customer_history (customer_number, latest_billed_at DESC);

CREATE TABLE IF NOT EXISTS customer_equipment_history (
  id text PRIMARY KEY,
  customer_id text,
  customer_number text NOT NULL,
  customer_name text,
  asset_id text,
  asset_number text,
  asset_type text,
  latest_invoice_no text,
  latest_lease_key text,
  first_billed_at timestamptz,
  latest_billed_at timestamptz,
  invoice_count integer NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_equipment_history_customer_idx
  ON customer_equipment_history (customer_number, latest_billed_at DESC);
CREATE INDEX IF NOT EXISTS customer_equipment_history_asset_idx
  ON customer_equipment_history (asset_number, latest_billed_at DESC);

CREATE TABLE IF NOT EXISTS lease_equipment_summary (
  id text PRIMARY KEY,
  lease_key text NOT NULL,
  customer_number text,
  customer_name text,
  asset_id text,
  asset_number text,
  asset_type text,
  invoice_count integer NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  first_billed_at timestamptz,
  latest_billed_at timestamptz,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lease_equipment_summary_lease_idx
  ON lease_equipment_summary (lease_key, latest_billed_at DESC);
CREATE INDEX IF NOT EXISTS lease_equipment_summary_asset_idx
  ON lease_equipment_summary (asset_number);

CREATE TABLE IF NOT EXISTS invoice_line_register (
  id text PRIMARY KEY,
  source_provider text NOT NULL,
  document_type text,
  document_no text NOT NULL,
  line_no integer NOT NULL,
  lease_key text,
  customer_number text,
  customer_name text,
  asset_id text,
  asset_number text,
  asset_type text,
  branch_code text,
  line_kind text,
  description text,
  quantity numeric(14,4),
  unit_price numeric(14,2),
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  tax_amount numeric(18,2) NOT NULL DEFAULT 0,
  damage_waiver_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  service_period_start timestamptz,
  service_period_end timestamptz,
  posting_date timestamptz,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_line_register_doc_line_unique
  ON invoice_line_register (source_provider, document_no, line_no);
CREATE INDEX IF NOT EXISTS invoice_line_register_invoice_idx
  ON invoice_line_register (document_no, line_no);
CREATE INDEX IF NOT EXISTS invoice_line_register_asset_activity_idx
  ON invoice_line_register (asset_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS invoice_line_register_customer_activity_idx
  ON invoice_line_register (customer_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS invoice_line_register_lease_activity_idx
  ON invoice_line_register (lease_key, posting_date DESC);
