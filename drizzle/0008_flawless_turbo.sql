CREATE TYPE "public"."person_role" AS ENUM('sponsor', 'fitness_trainer');--> statement-breakpoint
CREATE TABLE "person_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "person_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_roles_person_role_idx" ON "person_roles" USING btree ("person_id","role");