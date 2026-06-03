CREATE TABLE IF NOT EXISTS "global_search_identifier_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "key_text" text NOT NULL,
  "key_kind" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "href" text NOT NULL,
  "source" text NOT NULL,
  "branch_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "global_search_identifier_keys_key_prefix_idx"
  ON "global_search_identifier_keys" USING btree ("key_text" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "global_search_identifier_keys_entity_idx"
  ON "global_search_identifier_keys" USING btree ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "global_search_identifier_keys_branch_idx"
  ON "global_search_identifier_keys" USING btree ("branch_id");
