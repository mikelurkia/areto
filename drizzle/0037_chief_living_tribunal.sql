DROP TABLE "season_tasks" CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "federation_registered";--> statement-breakpoint
DROP TYPE "public"."season_task_kind";--> statement-breakpoint
DROP TYPE "public"."season_task_status";