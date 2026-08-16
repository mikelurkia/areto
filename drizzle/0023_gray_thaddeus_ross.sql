ALTER TYPE "public"."sponsorship_tier" ADD VALUE 'publicidad';--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "fiscal_name" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "fiscal_address" text;