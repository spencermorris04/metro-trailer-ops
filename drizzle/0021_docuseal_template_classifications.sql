CREATE TABLE IF NOT EXISTS "docuseal_template_classifications" (
  "docuseal_template_id" integer PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'other' NOT NULL,
  "folder_name" text DEFAULT '' NOT NULL,
  "location" text DEFAULT '' NOT NULL,
  "submitter_role" text DEFAULT 'First Party' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "docuseal_template_classifications_key_unique"
  ON "docuseal_template_classifications" USING btree ("template_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docuseal_template_classifications_category_idx"
  ON "docuseal_template_classifications" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docuseal_template_classifications_active_idx"
  ON "docuseal_template_classifications" USING btree ("active");
