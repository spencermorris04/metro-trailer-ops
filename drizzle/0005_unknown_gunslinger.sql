ALTER TYPE "public"."asset_allocation_type" ADD VALUE 'dispatch_hold' BEFORE 'on_rent';--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "yard_zone" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "yard_row" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "yard_slot" text;