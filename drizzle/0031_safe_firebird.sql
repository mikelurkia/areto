CREATE TYPE "public"."season_task_kind" AS ENUM('inscripcion_liga', 'inscripcion_copa', 'alta_equipo_plataforma', 'alta_jugadores_plataforma', 'otro');--> statement-breakpoint
CREATE TYPE "public"."season_task_status" AS ENUM('pending', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "season_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid,
	"kind" "season_task_kind" DEFAULT 'otro' NOT NULL,
	"title" text NOT NULL,
	"status" "season_task_status" DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"amount_cents" integer,
	"paid_on" date,
	"proof_path" text,
	"doc_path" text,
	"assignee" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "federation_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "season_tasks" ADD CONSTRAINT "season_tasks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_tasks" ADD CONSTRAINT "season_tasks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;