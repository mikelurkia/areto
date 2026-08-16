CREATE TYPE "public"."team_gender" AS ENUM('masculino', 'femenino');--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "gender" "team_gender";