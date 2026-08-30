ALTER TYPE "public"."fee_period" ADD VALUE 'installments';--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "installments_count" integer;