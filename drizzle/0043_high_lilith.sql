ALTER TABLE "persons" DROP CONSTRAINT "persons_guardian_id_persons_id_fk";
--> statement-breakpoint
INSERT INTO "person_guardians" ("person_id", "guardian_id", "is_primary")
SELECT "id", "guardian_id", true FROM "persons" WHERE "guardian_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "persons" DROP COLUMN "guardian_id";