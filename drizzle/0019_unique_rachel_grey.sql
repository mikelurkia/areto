CREATE TYPE "public"."sponsorship_tier" AS ENUM('principal', 'colaborador');--> statement-breakpoint
ALTER TABLE "sponsorships" ADD COLUMN "tier" "sponsorship_tier";--> statement-breakpoint
ALTER TABLE "sponsorships" ADD COLUMN "benefits" text;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD COLUMN "contract_path" text;