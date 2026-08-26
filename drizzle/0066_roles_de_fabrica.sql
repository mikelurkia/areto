-- Seis roles de fábrica en vez de cuatro.
--
-- Migración escrita a mano: no cambia el esquema, solo los datos, así que
-- `db:generate` no la produce.
--
-- Añade `player` (Jugador) y `basic` (Acceso básico), mueve el rol por defecto
-- de `member` a `basic`, marca los seis como de sistema y borra `presidente`.
--
-- La matriz de permisos va COPIADA LITERALMENTE, no importada de
-- `SYSTEM_ROLE_PERMISSIONS`: una migración que dependa del código de hoy deja
-- de ser reproducible mañana. Es la misma convención que sigue la 0061.

INSERT INTO "roles" ("key", "name", "description", "is_system", "is_default", "sort_order") VALUES
  ('player', 'Jokalaria', 'Bere taldea, denboraldiak eta egutegia ikusi.', true, false, 35),
  ('basic', 'Oinarrizko sarbidea', 'Kontu berri baten abiapuntua: taldeak eta denboraldiak ikusi.', true, false, 50)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

-- El rol por defecto se mueve en DOS sentencias, y en este orden.
-- `roles_single_default_idx` es un ÍNDICE único parcial, y un índice único no
-- puede declararse DEFERRABLE (solo puede una constraint): Postgres lo
-- comprueba fila a fila, en un orden que no está definido. Un
-- `SET is_default = (key = 'basic')` de una sola pasada puede tocar `basic`
-- antes que `member` y fallar con 23505 de forma intermitente. Limpiar primero
-- y marcar después es determinista.
UPDATE "roles" SET "is_default" = false WHERE "is_default" AND "key" <> 'basic';
--> statement-breakpoint

UPDATE "roles" SET "is_default" = true WHERE "key" = 'basic';
--> statement-breakpoint

UPDATE "roles" SET "is_system" = true
 WHERE "key" IN ('admin', 'staff', 'coach', 'player', 'member', 'basic');
--> statement-breakpoint

-- Permisos de fábrica de los roles nuevos, y el calendario que gana `member`
-- al pasar a ser "Socio" (antes solo veía equipos y temporadas).
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", v."permission"
  FROM "roles" r
  JOIN (VALUES
    ('player', 'equipos.view'),
    ('player', 'temporadas.view'),
    ('player', 'calendario.view'),
    ('basic', 'equipos.view'),
    ('basic', 'temporadas.view'),
    ('member', 'calendario.view')
  ) AS v("key", "permission") ON v."key" = r."key"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- `presidente` lo sembraba el seed de demo. No tiene usuarios en dev ni en
-- prod; si alguna base lo tuviera asignado, el ON DELETE RESTRICT de
-- `users.role_id` hace fallar la migración en vez de dejar cuentas sin rol.
DELETE FROM "roles" WHERE "key" = 'presidente';
