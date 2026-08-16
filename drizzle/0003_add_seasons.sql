CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fees" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_club_name_idx" ON "seasons" USING btree ("club_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_club_current_idx" ON "seasons" USING btree ("club_id") WHERE "seasons"."is_current";--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;