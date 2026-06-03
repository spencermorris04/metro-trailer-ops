CREATE INDEX IF NOT EXISTS "equipment_summary_asset_number_upper_prefix_idx"
  ON "equipment_summary" USING btree ((upper("asset_number")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_serial_upper_prefix_idx"
  ON "equipment_summary" USING btree ((upper("serial_number")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_registration_upper_prefix_idx"
  ON "equipment_summary" USING btree ((upper("registration_number")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_summary_service_item_upper_prefix_idx"
  ON "equipment_summary" USING btree ((upper("bc_service_item_no")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_summary_customer_number_upper_prefix_idx"
  ON "customer_summary" USING btree ((upper("customer_number")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_summary_name_upper_prefix_idx"
  ON "customer_summary" USING btree ((upper("name")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_register_summary_document_no_upper_prefix_idx"
  ON "invoice_register_summary" USING btree ((upper("document_no")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_register_summary_previous_no_upper_prefix_idx"
  ON "invoice_register_summary" USING btree ((upper("previous_no")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_register_summary_customer_number_upper_prefix_idx"
  ON "invoice_register_summary" USING btree ((upper("customer_number")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_summary_lease_key_upper_prefix_idx"
  ON "lease_summary" USING btree ((upper("lease_key")) text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_summary_customer_number_upper_prefix_idx"
  ON "lease_summary" USING btree ((upper("customer_number")) text_pattern_ops);
