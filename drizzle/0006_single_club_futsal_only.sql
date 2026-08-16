ALTER TABLE "clubs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "announcements" DROP CONSTRAINT "announcements_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "fees" DROP CONSTRAINT "fees_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "persons" DROP CONSTRAINT "persons_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "seasons" DROP CONSTRAINT "seasons_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_club_id_clubs_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_sport_id_sports_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_club_id_clubs_id_fk";
--> statement-breakpoint
DROP TABLE "clubs";--> statement-breakpoint
DROP TABLE "sports";--> statement-breakpoint
DROP INDEX "persons_club_email_idx";--> statement-breakpoint
DROP INDEX "seasons_club_name_idx";--> statement-breakpoint
DROP INDEX "seasons_club_current_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "persons_email_idx" ON "persons" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_name_idx" ON "seasons" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_current_idx" ON "seasons" USING btree ("is_current") WHERE "seasons"."is_current";--> statement-breakpoint
ALTER TABLE "announcements" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "fees" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "persons" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "sport_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "club_id";
