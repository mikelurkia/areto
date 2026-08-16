CREATE TYPE "public"."player_position" AS ENUM('cierre', 'ala', 'pivot', 'portero');--> statement-breakpoint
CREATE TABLE "team_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"label" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "positions" "player_position"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_documents" ADD CONSTRAINT "team_documents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_notes" ADD CONSTRAINT "team_notes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;