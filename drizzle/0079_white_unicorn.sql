CREATE TYPE "public"."economic_category_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."financial_account_kind" AS ENUM('bank', 'cash');--> statement-breakpoint
CREATE TYPE "public"."ledger" AS ENUM('official', 'internal');--> statement-breakpoint
CREATE TABLE "economic_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "economic_category_kind" NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "economic_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "financial_account_kind" DEFAULT 'bank' NOT NULL,
	"ledger" "ledger" DEFAULT 'official' NOT NULL,
	"iban" text,
	"opening_balance_cents" integer DEFAULT 0 NOT NULL,
	"opening_balance_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "economic_categories_kind_name_idx" ON "economic_categories" USING btree ("kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_name_idx" ON "financial_accounts" USING btree ("name");--> statement-breakpoint

-- A partir de aquí, DATOS escritos a mano (`db:generate` solo produce el
-- esquema). Dos cosas que el módulo necesita para arrancar usable:

-- 1. Los cuatro permisos nuevos en los roles de fábrica que los llevan.
--    `admin` los cuatro; `staff` (Secretaría) solo el par `official` — la junta
--    se modela como un rol al que se le marcan los `internal` desde la matriz.
--    La lista va COPIADA, no importada de `SYSTEM_ROLE_PERMISSIONS`: una
--    migración que dependa del código de hoy deja de ser reproducible mañana.
--    Misma convención que la 0061 y la 0066.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", v."permission"
  FROM "roles" r
  JOIN (VALUES
    ('admin', 'economia.official.view'),
    ('admin', 'economia.official.manage'),
    ('admin', 'economia.internal.view'),
    ('admin', 'economia.internal.manage'),
    ('staff', 'economia.official.view'),
    ('staff', 'economia.official.manage')
  ) AS v("key", "permission") ON v."key" = r."key"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 2. Un juego de categorías de partida. Van aquí y no en `db:seed` porque
--    producción no ejecuta el seed: un presupuesto sin categorías no se puede
--    empezar. Son editables desde /economia/cuentas, y se retiran con
--    `is_active`, nunca borrándolas.
INSERT INTO "economic_categories" ("kind", "name", "sort_order") VALUES
  ('income', 'Kuotak', 10),
  ('income', 'Babesletza', 20),
  ('income', 'Diru-laguntzak', 30),
  ('income', 'Ekitaldiak eta zozketak', 40),
  ('income', 'Bestelako sarrerak', 90),
  ('expense', 'Federazioa eta lizentziak', 10),
  ('expense', 'Arbitrajeak', 20),
  ('expense', 'Kirol-materiala', 30),
  ('expense', 'Ekipazioak', 40),
  ('expense', 'Instalazioak', 50),
  ('expense', 'Bidaiak', 60),
  ('expense', 'Entrenatzaileak', 70),
  ('expense', 'Kudeaketa eta banku-gastuak', 80),
  ('expense', 'Bestelako gastuak', 90)
ON CONFLICT DO NOTHING;
