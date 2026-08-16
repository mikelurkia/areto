ALTER TABLE "memberships" ADD COLUMN "is_captain" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "member_number" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "persons_member_number_idx" ON "persons" USING btree ("member_number");