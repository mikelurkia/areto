ALTER TABLE "teams" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."team_category";--> statement-breakpoint
CREATE TYPE "public"."team_category" AS ENUM('escuela', 'infantil', 'cadete', 'juvenil', 'senior');--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "category" SET DATA TYPE "public"."team_category" USING "category"::"public"."team_category";