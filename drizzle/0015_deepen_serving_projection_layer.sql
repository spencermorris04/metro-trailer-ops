CREATE TABLE IF NOT EXISTS rental_activity_facts (
  id text PRIMARY KEY,
  source_provider text NOT NULL,
  source_row_id text NOT NULL,
  external_entry_no text NOT NULL,
  document_type text,
  document_no text,
  lease_key text,
  customer_number text,
  customer_id text,
  customer_name text,
  asset_number text,
  asset_id text,
  asset_type text,
  activity_type text NOT NULL,
  posting_date timestamptz,
  service_period_start timestamptz,
  service_period_end timestamptz,
  quantity numeric(14,4),
  rental_days numeric(14,4),
  unit_price numeric(14,2),
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  branch_code text,
  deal_code text,
  source_imported_at timestamptz,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_activity_facts_source_row_unique
  ON rental_activity_facts (source_provider, source_row_id);
CREATE INDEX IF NOT EXISTS rental_activity_facts_asset_activity_idx
  ON rental_activity_facts (asset_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_activity_facts_customer_activity_idx
  ON rental_activity_facts (customer_number, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_activity_facts_lease_activity_idx
  ON rental_activity_facts (lease_key, posting_date DESC);
CREATE INDEX IF NOT EXISTS rental_activity_facts_document_idx
  ON rental_activity_facts (document_no);

CREATE TABLE IF NOT EXISTS gl_entry_facts (
  id text PRIMARY KEY,
  source_provider text NOT NULL,
  source_row_id text NOT NULL,
  external_entry_no text NOT NULL,
  posting_date timestamptz,
  document_no text,
  account_no text,
  account_name text,
  account_category text,
  description text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  debit_amount numeric(18,2) NOT NULL DEFAULT 0,
  credit_amount numeric(18,2) NOT NULL DEFAULT 0,
  dimension_set_id text,
  dimension_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_imported_at timestamptz,
  search_text text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gl_entry_facts_source_row_unique
  ON gl_entry_facts (source_provider, source_row_id);
CREATE UNIQUE INDEX IF NOT EXISTS gl_entry_facts_external_entry_unique
  ON gl_entry_facts (source_provider, external_entry_no);
CREATE INDEX IF NOT EXISTS gl_entry_facts_posting_date_idx
  ON gl_entry_facts (posting_date DESC);
CREATE INDEX IF NOT EXISTS gl_entry_facts_account_activity_idx
  ON gl_entry_facts (account_no, posting_date DESC);
CREATE INDEX IF NOT EXISTS gl_entry_facts_document_activity_idx
  ON gl_entry_facts (document_no, posting_date DESC);
