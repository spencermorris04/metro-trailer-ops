CREATE INDEX IF NOT EXISTS "bc_rmi_prl_posting_date_idx" ON "bc_rmi_posted_rental_lines" USING btree ("posting_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_customer_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("bill_to_customer_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_posting_date_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("posting_date");
