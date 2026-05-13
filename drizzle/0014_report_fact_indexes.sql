CREATE INDEX IF NOT EXISTS "rental_billing_facts_posting_date_idx"
  ON "rental_billing_facts" USING btree ("posting_date");

CREATE INDEX IF NOT EXISTS "rental_invoice_facts_posting_date_idx"
  ON "rental_invoice_facts" USING btree ("posting_date");

CREATE INDEX IF NOT EXISTS "ar_ledger_facts_open_due_idx"
  ON "ar_ledger_facts" USING btree ("is_open", "due_date");
