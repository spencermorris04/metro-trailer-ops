CREATE TABLE IF NOT EXISTS "docuseal_prefill_defaults" (
  "id" text PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_key" text NOT NULL,
  "values" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "docuseal_prefill_defaults_template_scope_unique"
  ON "docuseal_prefill_defaults" USING btree ("template_key", "scope_type", "scope_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docuseal_prefill_defaults_template_idx"
  ON "docuseal_prefill_defaults" USING btree ("template_key");
