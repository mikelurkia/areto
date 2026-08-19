ALTER TABLE "registrations" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."registration_kind";--> statement-breakpoint
CREATE TYPE "public"."registration_kind" AS ENUM('player', 'member');--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "kind" SET DATA TYPE "public"."registration_kind" USING "kind"::"public"."registration_kind";--> statement-breakpoint
ALTER TABLE "club_settings" DROP COLUMN "coach_registration_open";