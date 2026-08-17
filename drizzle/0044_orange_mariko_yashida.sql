CREATE TYPE "public"."club_member_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TABLE "club_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "club_member_status" DEFAULT 'active' NOT NULL,
	"member_number" integer,
	"joined_at" date NOT NULL,
	"cancelled_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "club_members" ("person_id", "status", "member_number", "joined_at")
SELECT "id", 'active', "member_number", CURRENT_DATE
FROM "persons"
WHERE "is_member" = true;--> statement-breakpoint
DROP INDEX "persons_member_number_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "club_members_person_idx" ON "club_members" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_members_member_number_idx" ON "club_members" USING btree ("member_number");--> statement-breakpoint
ALTER TABLE "persons" DROP COLUMN "is_member";--> statement-breakpoint
ALTER TABLE "persons" DROP COLUMN "member_number";