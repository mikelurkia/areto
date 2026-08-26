import { and, eq, ne } from "drizzle-orm";

import { db } from "./index";
import { rolePermissions, roles } from "./schema";
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "../lib/permissions";

/**
 * Roles de fábrica. En una base de datos que venga de producción ya los habrá
 * creado la migración `0061`; esto es para las que se levantan de cero con
 * `db:push`, que se salta el historial de migraciones.
 *
 * Idempotente y no destructivo: si el rol ya existe no se toca su matriz (puede
 * que el club se la haya ajustado), solo se le añaden los permisos que le
 * falten de la lista de fábrica. `isSystem` sí se fuerza, porque la lista de
 * roles protegidos la manda el código, no la base.
 *
 * El rol por defecto se coloca en una pasada aparte, al final: `roles` lleva un
 * índice único parcial sobre `is_default`, así que insertar el nuevo rol por
 * defecto mientras el viejo aún lo tiene reventaría. Primero se siembran todos
 * sin la marca y después se mueve de un tirón.
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
        isDefault: false,
        sortOrder: role.sortOrder,
      })
      .onConflictDoUpdate({
        target: roles.key,
        set: { isSystem: true },
      });

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

  // El rol por defecto, al final y en DOS pasadas. `roles_single_default_idx`
  // es un índice único parcial, y un índice único no puede ser DEFERRABLE:
  // Postgres lo comprueba fila a fila y en un orden que no está definido, así
  // que una sola sentencia que marque uno y desmarque otro puede fallar con
  // 23505 según a quién toque primero. Limpiar y luego marcar es determinista.
  const defaultRole = SYSTEM_ROLES.find((r) => r.isDefault);
  if (defaultRole) {
    await db
      .update(roles)
      .set({ isDefault: false })
      .where(and(eq(roles.isDefault, true), ne(roles.key, defaultRole.key)));

    await db
      .update(roles)
      .set({ isDefault: true })
      .where(eq(roles.key, defaultRole.key));
  }
}
