ALTER TABLE "bc_gl_entries"
  DROP CONSTRAINT IF EXISTS "bc_gl_entries_dimension_set_id_bc_dimension_sets_id_fk";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bc_gl_entries_dimension_set_id_idx"
  ON "bc_gl_entries" USING btree ("dimension_set_id");
