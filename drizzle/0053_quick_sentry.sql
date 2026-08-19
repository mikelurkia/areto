ALTER TYPE "public"."registration_kind" ADD VALUE 'member';--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "member_registration_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "member_annual_fee_cents" integer DEFAULT 2000 NOT NULL;