CREATE TABLE "season_category_birth_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"category" "team_category" NOT NULL,
	"min_birth_year" integer,
	"max_birth_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season_category_birth_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "season_category_birth_years" ADD CONSTRAINT "season_category_birth_years_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "season_category_birth_years_season_category_idx" ON "season_category_birth_years" USING btree ("season_id","category");