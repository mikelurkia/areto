ALTER TABLE "fees" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fees" DROP COLUMN "season";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "season";