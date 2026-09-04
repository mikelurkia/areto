CREATE TYPE "public"."budget_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"planned_cents" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "season_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"ledger" "ledger" DEFAULT 'official' NOT NULL,
	"status" "budget_status" DEFAULT 'draft' NOT NULL,
	"approved_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season_budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_season_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."season_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_id_economic_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."economic_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_budgets" ADD CONSTRAINT "season_budgets_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_lines_budget_category_idx" ON "budget_lines" USING btree ("budget_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "season_budgets_season_ledger_idx" ON "season_budgets" USING btree ("season_id","ledger");