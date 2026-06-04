CREATE TABLE IF NOT EXISTS "docuseal_prefill_drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL,
  "template_name" text NOT NULL,
  "docuseal_template_id" integer NOT NULL,
  "location" text NOT NULL,
  "submitter_role" text NOT NULL,
  "customer_name" text DEFAULT '' NOT NULL,
  "customer_email" text DEFAULT '' NOT NULL,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "values" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "sent_at" timestamp with time zone,
  "docuseal_submission_id" integer,
  "docuseal_submitter_slug" text,
  "docuseal_submitter_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docuseal_prefill_drafts_status_idx"
  ON "docuseal_prefill_drafts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docuseal_prefill_drafts_updated_at_idx"
  ON "docuseal_prefill_drafts" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docuseal_prefill_drafts_template_idx"
  ON "docuseal_prefill_drafts" USING btree ("template_key");
