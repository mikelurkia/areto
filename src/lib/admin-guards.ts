import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { rolePermissions, users } from "@/db/schema";
import type { Permission } from "@/lib/permissions";

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
 * Cuántos usuarios activos pueden gestionar usuarios ahora mismo.
 *
 * `excludeUserId` responde a "¿y si a esta persona la desactivo/borro/degrado?";
 * `excludeRoleId`, a "¿y si a este rol le quito el permiso?".
 */
export async function countActiveAdmins(opts?: {
  excludeUserId?: string;
  excludeRoleId?: string;
}): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, users.roleId))
    .where(
      and(
        eq(users.status, "active"),
        eq(rolePermissions.permission, ADMIN_PERMISSION),
        opts?.excludeUserId ? ne(users.id, opts.excludeUserId) : undefined,
        opts?.excludeRoleId ? ne(users.roleId, opts.excludeRoleId) : undefined,
      ),
    );

  return row?.count ?? 0;
}

/** Permisos concedidos por un rol, tal y como están guardados. */
export async function getRolePermissions(roleId: string): Promise<Set<string>> {
  const rows = await db.query.rolePermissions.findMany({
    where: eq(rolePermissions.roleId, roleId),
    columns: { permission: true },
  });
  return new Set(rows.map((r) => r.permission));
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

/** ¿Asignar este rol supone repartir permisos de administración? */
export async function roleEscalates(roleId: string): Promise<boolean> {
  const granted = await getRolePermissions(roleId);
  return ESCALATING_PERMISSIONS.some((p) => granted.has(p));
}
