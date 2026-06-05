CREATE INDEX IF NOT EXISTS "bc_rmi_ws_rle_active_rental_idx"
  ON "bc_rmi_ws_rental_ledger_entries" USING btree (
    "thru_date",
    "from_date",
    "bill_to_customer_no",
    "no_shipped"
  )
  WHERE "document_type" = 'Posted Invoice'
    AND "type_shipped" = 'Fixed Asset'
    AND "bill_to_customer_no" IS NOT NULL
    AND "bill_to_customer_no" <> ''
    AND "no_shipped" IS NOT NULL
    AND "no_shipped" <> '';
