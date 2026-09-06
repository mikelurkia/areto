CREATE TABLE "person_data_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"signed_on" date,
	"file_path" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_data_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "person_data_consents" ADD CONSTRAINT "person_data_consents_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_data_consents" ADD CONSTRAINT "person_data_consents_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_data_consents_person_idx" ON "person_data_consents" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_data_consents_person_season_idx" ON "person_data_consents" USING btree ("person_id","season_id");