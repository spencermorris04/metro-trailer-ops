ALTER TABLE "docuseal_template_classifications"
ADD COLUMN IF NOT EXISTS "customer_editable_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;
