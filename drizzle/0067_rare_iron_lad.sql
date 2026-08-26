CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint

-- Backfill: la puente arranca siendo una copia exacta de `users.role_id`.
--
-- Va en la MISMA migración que el CREATE TABLE a propósito. Mientras la tabla
-- exista vacía, cualquier lector nuevo vería a todo el mundo sin ningún
-- permiso; dejar el relleno para un paso posterior abriría esa ventana en
-- producción.
--
-- A partir de aquí y hasta que se retire `users.role_id`, las dos fuentes se
-- mantienen en sincronía desde `setUserRoles()` (`src/lib/user-roles.ts`).
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."id", u."role_id" FROM "users" u WHERE u."role_id" IS NOT NULL
ON CONFLICT DO NOTHING;
