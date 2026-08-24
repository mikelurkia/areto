CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_single_default_idx" ON "roles" USING btree ("is_default") WHERE "roles"."is_default";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_person_idx" ON "users" USING btree ("person_id") WHERE "users"."person_id" is not null;
--> statement-breakpoint
-- ===========================================================================
-- Backfill: siembra los cuatro roles de fábrica y engancha a ellos los
-- usuarios existentes.
--
-- Va aquí dentro y no en un script aparte porque es lo único que garantiza que
-- se ejecute una vez y en orden tanto en `areto-dev` (CI, `npm run db:migrate`)
-- como en producción (`migrate-prod.yml`, al mergear). Con `role_id` a null
-- nadie tendría ningún permiso, así que la ventana entre migrar y rellenar
-- tiene que ser cero.
--
-- La lista de permisos de abajo es una FOTOGRAFÍA de
-- `SYSTEM_ROLE_PERMISSIONS` (src/lib/permissions.ts) en el momento de escribir
-- esta migración, y no se vuelve a tocar aunque aquella cambie: una migración
-- que dependiera del código de hoy dejaría de ser reproducible mañana.
--
-- Todo idempotente (`on conflict do nothing`): `areto-dev` puede haber
-- recibido ya el esquema por `db:push`.
-- ===========================================================================

INSERT INTO "roles" ("key", "name", "description", "is_system", "is_default", "sort_order") VALUES
  ('admin',  'Administratzailea', 'Klubaren kudeaketa osoa, erabiltzaileak eta rolak barne.', true, false, 10),
  ('staff',  'Idazkaritza',       'Idazkaritza eta diruzaintza: pertsonak, bazkideak, izen-emateak eta ekonomia.', true, false, 20),
  ('coach',  'Entrenatzailea',    'Bere taldeak: plantilla ikusi, akta eta kantxa-eskaerak.', true, false, 30),
  ('member', 'Bazkidea',          'Irakurketa soila: taldeak eta denboraldiak.', true, true, 40)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p.permission
FROM "roles" r
JOIN (VALUES
  ('admin', 'personas.view'),
  ('admin', 'personas.manage'),
  ('admin', 'personas.medical.view'),
  ('admin', 'personas.medical.manage'),
  ('admin', 'socios.view'),
  ('admin', 'socios.manage'),
  ('admin', 'inscripciones.view'),
  ('admin', 'inscripciones.manage'),
  ('admin', 'equipos.view'),
  ('admin', 'equipos.manage'),
  ('admin', 'equipos.acta'),
  ('admin', 'temporadas.view'),
  ('admin', 'temporadas.manage'),
  ('admin', 'calendario.view'),
  ('admin', 'calendario.manage'),
  ('admin', 'calendario.manage.all'),
  ('admin', 'patrocinadores.view'),
  ('admin', 'patrocinadores.manage'),
  ('admin', 'club.view'),
  ('admin', 'club.manage'),
  ('admin', 'usuarios.manage'),
  ('admin', 'roles.manage'),
  ('staff', 'personas.view'),
  ('staff', 'personas.manage'),
  ('staff', 'personas.medical.view'),
  ('staff', 'personas.medical.manage'),
  ('staff', 'socios.view'),
  ('staff', 'socios.manage'),
  ('staff', 'inscripciones.view'),
  ('staff', 'inscripciones.manage'),
  ('staff', 'equipos.view'),
  ('staff', 'equipos.manage'),
  ('staff', 'equipos.acta'),
  ('staff', 'temporadas.view'),
  ('staff', 'temporadas.manage'),
  ('staff', 'calendario.view'),
  ('staff', 'calendario.manage'),
  ('staff', 'calendario.manage.all'),
  ('staff', 'patrocinadores.view'),
  ('staff', 'patrocinadores.manage'),
  ('staff', 'club.view'),
  ('staff', 'club.manage'),
  ('coach', 'equipos.view'),
  ('coach', 'equipos.acta'),
  ('coach', 'temporadas.view'),
  ('coach', 'calendario.view'),
  ('coach', 'calendario.manage'),
  ('member', 'equipos.view'),
  ('member', 'temporadas.view')
) AS p(role_key, permission) ON p.role_key = r."key"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Cada usuario conserva exactamente el acceso que tenía: su rol viejo (enum)
-- se convierte en el rol de sistema del mismo nombre.
UPDATE "users" u
SET "role_id" = r."id"
FROM "roles" r
WHERE r."key" = u."role"::text AND u."role_id" IS NULL;
--> statement-breakpoint
-- Red de seguridad: nadie se queda sin rol (y por tanto sin ningún permiso).
UPDATE "users"
SET "role_id" = (SELECT "id" FROM "roles" WHERE "is_default" LIMIT 1)
WHERE "role_id" IS NULL;
--> statement-breakpoint
-- Las cuentas que ya existían están activas: el default `pending` solo aplica
-- a las altas nuevas. `invited_at = created_at` evita que el blindaje del
-- callback de OAuth las confunda con un alta no invitada.
UPDATE "users"
SET "status" = 'active', "invited_at" = COALESCE("invited_at", "created_at");
