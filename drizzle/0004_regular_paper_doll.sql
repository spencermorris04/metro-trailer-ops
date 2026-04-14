CREATE TYPE "public"."signature_appearance_mode" AS ENUM('handwriting_font', 'drawn', 'uploaded_image');--> statement-breakpoint
ALTER TABLE "signature_requests" ADD COLUMN "signing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD COLUMN "signature_mode" "signature_appearance_mode";--> statement-breakpoint
ALTER TABLE "signature_signers" ADD COLUMN "signature_appearance_data_url" text;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD COLUMN "signature_appearance_hash" text;