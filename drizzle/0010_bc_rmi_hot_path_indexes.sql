CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_document_no_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_customer_posting_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("bill_to_customer_no", "posting_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_posting_document_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("posting_date", "document_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_posting_document_desc_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("posting_date" DESC NULLS LAST, "document_no" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_rmi_inv_hdr_previous_posting_idx" ON "bc_rmi_posted_rental_invoice_headers" USING btree ("previous_doc_type", "previous_no", "posting_date");
--> statement-breakpoint
ANALYZE "bc_rmi_posted_rental_invoice_headers";
--> statement-breakpoint
ANALYZE "bc_rmi_posted_rental_lines";
