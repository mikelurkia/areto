CREATE TYPE "public"."boot_type" AS ENUM('studs', 'other');--> statement-breakpoint
CREATE TYPE "public"."injury_place" AS ENUM('match', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."match_minute" AS ENUM('0-15', '16-30', '31-45', '46-60', '61-75', '76-90');--> statement-breakpoint
CREATE TYPE "public"."pitch_surface" AS ENUM('natural', 'artificial', 'soil', 'other');--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "federation_delegation" text;--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "signatory_name" text;--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "signatory_national_id" text;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "reported_on" date;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "reported_place" text;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "place" "injury_place";--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "place_other" text;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "match_minute" "match_minute";--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "surface" "pitch_surface";--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "collision" boolean;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "opponent_team" text;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "related_to_previous" boolean;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "boot_type" "boot_type";--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "training_surface" "pitch_surface";--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD COLUMN "weekly_training_minutes" integer;--> statement-breakpoint
ALTER TABLE "person_injury_reports" ADD CONSTRAINT "person_injury_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;