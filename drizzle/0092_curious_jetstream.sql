ALTER TYPE "public"."audit_action" ADD VALUE 'view';--> statement-breakpoint
CREATE TABLE "club_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"holder_name" text,
	"number_encrypted" text NOT NULL,
	"last4" text NOT NULL,
	"expiry_month" integer NOT NULL,
	"expiry_year" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- A partir de aquí, DATOS escritos a mano (`db:generate` solo produce el
-- esquema). Los dos permisos nuevos en los roles de fábrica que los llevan:
-- solo `admin`. `staff` (Secretaría) NO los lleva a propósito — las tarjetas
-- del club son de quien lleva la economía, y se conceden desde la matriz de
-- /administracion/roles a quien toque.
-- La lista va COPIADA, no importada de `SYSTEM_ROLE_PERMISSIONS`: una
-- migración que dependa del código de hoy deja de ser reproducible mañana.
-- Misma convención que la 0061, la 0066 y la 0079.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", v."permission"
  FROM "roles" r
  JOIN (VALUES
    ('admin', 'club.payments.view'),
    ('admin', 'club.payments.manage')
  ) AS v("key", "permission") ON v."key" = r."key"
ON CONFLICT DO NOTHING;
