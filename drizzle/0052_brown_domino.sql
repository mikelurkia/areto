ALTER TABLE "club_settings" ADD COLUMN "player_registration_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "club_settings" ADD COLUMN "coach_registration_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "club_settings" ("player_registration_open", "coach_registration_open")
SELECT COALESCE(s.player_registration_open, false), COALESCE(s.coach_registration_open, false)
FROM "seasons" s
WHERE s.is_current = true
  AND NOT EXISTS (SELECT 1 FROM "club_settings");--> statement-breakpoint
UPDATE "club_settings"
SET player_registration_open = COALESCE((SELECT s.player_registration_open FROM "seasons" s WHERE s.is_current = true), false),
    coach_registration_open = COALESCE((SELECT s.coach_registration_open FROM "seasons" s WHERE s.is_current = true), false);--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "player_registration_open";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "coach_registration_open";
