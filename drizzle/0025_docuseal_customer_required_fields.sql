ALTER TABLE "docuseal_template_classifications"
ADD COLUMN IF NOT EXISTS "customer_required_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;
