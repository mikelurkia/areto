import { eq } from "drizzle-orm";

import { db } from "./index";
import { rolePermissions, roles } from "./schema";
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "../lib/permissions";

/**
 * Roles de fábrica. En una base de datos que venga de producción ya los habrá
 * creado la migración `0061`; esto es para las que se levantan de cero con
 * `db:push`, que se salta el historial de migraciones.
 *
 * Idempotente y no destructivo: si el rol ya existe no se toca (puede que el
 * club le haya ajustado la matriz), solo se le añaden los permisos que le
 * falten de la lista de fábrica.
 *
 * Vive en su propio módulo, y no en `seed.ts`, porque `seed-demo.ts` también
 * la necesita e importar `seed.ts` ejecutaría su `main()`.
 */
export async function seedRoles() {
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
