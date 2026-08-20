CREATE TYPE "public"."court_event_kind" AS ENUM('match');--> statement-breakpoint
CREATE TYPE "public"."preferred_day" AS ENUM('saturday', 'sunday', 'either');--> statement-breakpoint
CREATE TABLE "court_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "court_event_kind" DEFAULT 'match' NOT NULL,
	"team_id" uuid,
	"title" text,
	"weekend_of" date NOT NULL,
	"opponent" text,
	"is_home" boolean,
	"preferred_day" "preferred_day",
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "court_events" ADD CONSTRAINT "court_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_events" ADD CONSTRAINT "court_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "court_events_weekend_idx" ON "court_events" USING btree ("weekend_of");--> statement-breakpoint
CREATE INDEX "court_events_team_idx" ON "court_events" USING btree ("team_id");