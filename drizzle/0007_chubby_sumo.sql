UPDATE "teams" SET "category" = lower("category");--> statement-breakpoint
UPDATE "teams" SET "category" = NULL WHERE "category" NOT IN ('senior', 'juvenil', 'cadete', 'infantil', 'escuela');--> statement-breakpoint
CREATE TYPE "public"."team_category" AS ENUM('senior', 'juvenil', 'cadete', 'infantil', 'escuela');--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "category" SET DATA TYPE "public"."team_category" USING "category"::"public"."team_category";