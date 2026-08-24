import "dotenv/config";
import { eq } from "drizzle-orm";

import { db } from "./index";
import { rolePermissions, roles, seasons, teams } from "./schema";
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "../lib/permissions";

/**
 * Datos iniciales mínimos para arrancar en desarrollo.
 * Ejecuta con: npm run db:seed
 */
/**
 * Roles de fábrica. En una base de datos que venga de producción ya los habrá
 * creado la migración `0061`; esto es para las que se levantan de cero con
 * `db:push`, que se salta el historial de migraciones.
 *
 * Idempotente y no destructivo: si el rol ya existe no se toca (puede que el
 * club le haya ajustado la matriz), solo se le añaden los permisos que le
 * falten de la lista de fábrica.
 */
async function seedRoles() {
  for (const role of SYSTEM_ROLES) {
    await db
      .insert(roles)
      .values({
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
        isDefault: role.isDefault,
        sortOrder: role.sortOrder,
      })
      .onConflictDoNothing({ target: roles.key });

    const stored = await db.query.roles.findFirst({ where: eq(roles.key, role.key) });
    if (!stored) continue;

    await db
      .insert(rolePermissions)
      .values(
        SYSTEM_ROLE_PERMISSIONS[role.key].map((permission) => ({
          roleId: stored.id,
          permission,
        })),
      )
      .onConflictDoNothing();
  }
}

async function main() {
  console.log("🌱 Sembrando datos iniciales...");

  await seedRoles();

  const [season] = await db
    .insert(seasons)
    .values({ name: "2025/26", isCurrent: true })
    .onConflictDoNothing()
    .returning();

  if (season) {
    await db
      .insert(teams)
      .values([
        { seasonId: season.id, name: "Senior A", category: "senior" },
        { seasonId: season.id, name: "Cadete", category: "cadete" },
      ])
      .onConflictDoNothing();
  }

  console.log("✅ Datos iniciales listos.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en el seed:", err);
  process.exit(1);
});
