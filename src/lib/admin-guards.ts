import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { rolePermissions, userRoles, users } from "@/db/schema";
import { isPermission, type Permission } from "@/lib/permissions";

/**
 * Guardas compartidas por las acciones de `/administracion`.
 *
 * Todas responden a la misma pregunta: ¿este cambio deja al club sin nadie que
 * pueda administrar la aplicación? Sin ellas, quitarse el permiso a uno mismo o
 * desactivar al último administrador solo se arregla entrando a la base de
 * datos a mano, que es exactamente lo que esta funcionalidad venía a evitar.
 */

/** Permiso que define "poder administrar": quien lo tiene puede dar acceso a otros. */
export const ADMIN_PERMISSION: Permission = "usuarios.manage";

/**
 * Estado hipotético sobre el que preguntar. Todo lo que no se indique se toma
 * como está guardado.
 */
export type AdminSimulation = {
  /** roleId → permisos NUEVOS de ese rol. `null` = el rol desaparece. */
  rolePermissions?: ReadonlyMap<string, ReadonlySet<Permission> | null>;
  /** userId → roles NUEVOS de esa cuenta. `null` = la cuenta deja de contar. */
  userRoles?: ReadonlyMap<string, readonly string[] | null>;
  /** Quien tenga `from` pasa a tener `to` en su lugar. */
  reassign?: { from: string; to: string };
};

/**
 * Cuántas personas activas podrían gestionar usuarios SI se aplicara `sim`.
 *
 * Se resuelve en memoria y no en SQL a propósito. La pregunta real es "¿qué
 * pasaría después de este cambio?", y con varios roles por cuenta ya no se
 * puede expresar como una condición sobre el estado actual: quitarle un rol a
 * alguien solo le quita el permiso si NINGUNO de sus otros roles se lo concede,
 * y un guardado de la matriz puede quitar la administración de un rol y dársela
 * a otro a la vez. Restar (que es lo único que sabía hacer el viejo
 * `excludeRoleId`) daría falsos positivos y falsos negativos.
 *
 * Son dos escaneos de dos tablas diminutas, en páginas que se tocan una vez
 * cada varios meses.
 */
export async function countActiveAdminsAfter(
  sim: AdminSimulation = {},
): Promise<number> {
  const [assignments, permissionRows] = await Promise.all([
    db
      .select({ userId: userRoles.userId, roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(users.status, "active")),
    db
      .select({
        roleId: rolePermissions.roleId,
        permission: rolePermissions.permission,
      })
      .from(rolePermissions),
  ]);

  // Qué roles concede la administración, tras aplicar la simulación.
  const grants = new Map<string, boolean>();
  for (const row of permissionRows) {
    if (row.permission === ADMIN_PERMISSION) grants.set(row.roleId, true);
  }
  for (const [roleId, next] of sim.rolePermissions ?? []) {
    grants.set(roleId, next != null && next.has(ADMIN_PERMISSION));
  }

  // Qué roles tiene cada cuenta activa, tras aplicar la simulación.
  const byUser = new Map<string, Set<string>>();
  for (const { userId, roleId } of assignments) {
    let set = byUser.get(userId);
    if (!set) byUser.set(userId, (set = new Set()));
    set.add(roleId);
  }
  if (sim.reassign) {
    const { from, to } = sim.reassign;
    for (const set of byUser.values()) {
      if (set.delete(from)) set.add(to);
    }
  }
  for (const [userId, next] of sim.userRoles ?? []) {
    if (next == null) byUser.delete(userId);
    else byUser.set(userId, new Set(next));
  }

  let count = 0;
  for (const set of byUser.values()) {
    for (const roleId of set) {
      if (grants.get(roleId)) {
        count += 1;
        break; // la persona cuenta UNA vez, tenga los roles que tenga
      }
    }
  }
  return count;
}

/**
 * Permisos que solo puede repartir quien administra los roles.
 *
 * Sin esto, alguien con `usuarios.manage` pero sin `roles.manage` podría
 * asignarle a un tercero (o a sí mismo, invitándose con otro correo) el rol de
 * administrador, y saltarse por completo la separación entre "dar de alta a
 * gente" y "decidir qué puede hacer cada cual".
 */
export const ESCALATING_PERMISSIONS: readonly Permission[] = [
  "usuarios.manage",
  "roles.manage",
];

/** ¿Asignar alguno de estos roles supone repartir permisos de administración? */
export async function rolesEscalate(roleIds: readonly string[]): Promise<boolean> {
  if (roleIds.length === 0) return false;
  const rows = await db
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(
      and(
        inArray(rolePermissions.roleId, [...roleIds]),
        inArray(rolePermissions.permission, [...ESCALATING_PERMISSIONS]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Permisos que tendría esta persona si sus roles fueran `roleIds`. Filtrado
 * contra el catálogo del código, como `getCurrentUser`.
 */
export async function permissionsOfRoles(
  roleIds: readonly string[],
): Promise<Set<Permission>> {
  if (roleIds.length === 0) return new Set();
  const rows = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, [...roleIds]));
  return new Set(rows.map((r) => r.permission).filter(isPermission));
}
