"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { rolePermissions, roles, userRoles, users } from "@/db/schema";
import { countActiveAdminsAfter, permissionsOfRoles } from "@/lib/admin-guards";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import {
  ADMIN_LOCKED_PERMISSIONS,
  isPermission,
  type Permission,
} from "@/lib/permissions";
import { revalidateAppShell } from "@/lib/revalidate";

export type RoleState = {
  error?: string;
  message?: string;
};

/** Convierte el nombre visible en una clave estable para un rol nuevo. */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    // Marcas diacríticas combinantes: "Coordinación" -> "coordinacion".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Deja una sola fila con `isDefault`. Misma mecánica que `seasons.isCurrent`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function clearDefault(tx: Tx) {
  await tx.update(roles).set({ isDefault: false });
}

export async function createRole(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("roles.manage");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const copyFromRoleId = String(formData.get("copyFromRoleId") ?? "").trim();
  const makeDefault = formData.get("makeDefault") === "on";

  if (!name) return { error: t("roleNameRequired") };
  if (name.length > 60) return { error: t("roleNameTooLong") };

  const key = slugify(name);
  if (!key) return { error: t("roleNameInvalid") };

  let createdRoleId: string | undefined;
  try {
    await db.transaction(async (tx) => {
      if (makeDefault) await clearDefault(tx);

      const [created] = await tx
        .insert(roles)
        .values({
          key,
          name,
          description: description || null,
          isSystem: false,
          isDefault: makeDefault,
          sortOrder: 100,
        })
        .returning({ id: roles.id });
      createdRoleId = created?.id;

      if (!created || !copyFromRoleId) return;

      const source = await tx.query.rolePermissions.findMany({
        where: eq(rolePermissions.roleId, copyFromRoleId),
        columns: { permission: true },
      });
      if (source.length === 0) return;

      await tx
        .insert(rolePermissions)
        .values(
          source.map((p) => ({ roleId: created.id, permission: p.permission })),
        )
        .onConflictDoNothing();
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      return { error: t("roleNameTaken") };
    }
    throw error;
  }

  if (createdRoleId) {
    await recordAuditEvent({
      actorUserId: current.id,
      action: "create",
      entityType: "role_permissions",
      entityId: createdRoleId,
      metadata: { name, copyFromRoleId: copyFromRoleId || null },
    });
  }
  revalidateAppShell();
  return { message: t("roleCreated") };
}

export async function updateRole(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("roles.manage");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const makeDefault = formData.get("makeDefault") === "on";

  const role = await db.query.roles.findFirst({ where: eq(roles.id, id) });
  if (!role) return { error: t("roleNotFound") };

  // Los roles de fábrica conservan su nombre: la interfaz los traduce por su
  // clave, así que renombrarlos dejaría la etiqueta a medias entre idiomas.
  if (!role.isSystem && !name) return { error: t("roleNameRequired") };
  if (name.length > 60) return { error: t("roleNameTooLong") };

  // Desmarcar el rol por defecto sin poner otro dejaría a las cuentas nuevas
  // sin rol —y por tanto sin ningún permiso— en cuanto alguien se registrara.
  if (role.isDefault && !makeDefault) return { error: t("defaultRoleRequired") };

  try {
    await db.transaction(async (tx) => {
      if (makeDefault) await clearDefault(tx);
      await tx
        .update(roles)
        .set({
          name: role.isSystem ? role.name : name,
          description: description || null,
          isDefault: makeDefault,
        })
        .where(eq(roles.id, id));
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      return { error: t("roleNameTaken") };
    }
    throw error;
  }

  await recordAuditEvent({
    actorUserId: current.id,
    action: "update",
    entityType: "role_permissions",
    entityId: id,
    metadata: { name, makeDefault },
  });
  revalidateAppShell();
  return { message: t("roleUpdated") };
}

export async function deleteRole(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("roles.manage");

  const id = String(formData.get("id") ?? "");
  const reassignRoleId = String(formData.get("reassignRoleId") ?? "").trim();

  const role = await db.query.roles.findFirst({ where: eq(roles.id, id) });
  if (!role) return { error: t("roleNotFound") };
  if (role.isSystem) return { error: t("cannotDeleteSystemRole") };
  if (role.isDefault) return { error: t("cannotDeleteDefaultRole") };

  // Quién lo tiene, leído de la puente (la fuente de verdad), no de
  // `users.role_id`.
  const assigned = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, id));

  // Con varios roles por cuenta, perder este solo deja a alguien sin acceso si
  // era el único que tenía. Reasignar solo es obligatorio para esos.
  const orphans =
    assigned.length === 0
      ? []
      : await db
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(
            inArray(
              userRoles.userId,
              assigned.map((a) => a.userId),
            ),
          )
          .groupBy(userRoles.userId)
          .having(sql`count(*) = 1`);

  if (assigned.length > 0) {
    if (orphans.length > 0 && !reassignRoleId) {
      return { error: t("roleHasUsers", { count: orphans.length }) };
    }
    const target = reassignRoleId
      ? await db.query.roles.findFirst({
          where: and(eq(roles.id, reassignRoleId), ne(roles.id, id)),
        })
      : null;
    if (orphans.length > 0 && !target) {
      return { error: t("reassignRoleRequired") };
    }

    // Si el rol que desaparece era el que sostenía la administración y el
    // destino no lo hace, el club se quedaría sin nadie que pueda entrar aquí.
    // Se simula el resultado completo (el rol se va, sus usuarios pasan al
    // destino) en vez de restar: con varios roles por cuenta, restar el que se
    // borra ignoraría que a alguien se lo concede otro de los suyos.
    const remaining = await countActiveAdminsAfter({
      ...(target ? { reassign: { from: id, to: target.id } } : {}),
      rolePermissions: new Map([[id, null]]),
    });
    if (remaining === 0) return { error: t("lastAdminGuard") };

    await db.transaction(async (tx) => {
      // El orden importa: `user_roles.role_id` y `users.role_id` son ambos
      // RESTRICT, así que hay que soltar las dos referencias antes de borrar
      // el rol o el DELETE falla con 23503.
      if (target) {
        await tx
          .insert(userRoles)
          .values(assigned.map((a) => ({ userId: a.userId, roleId: target.id })))
          .onConflictDoNothing();
      }
      await tx.delete(userRoles).where(eq(userRoles.roleId, id));
      // DEUDA EXPAND: mientras `users.role_id` exista hay que recolocarla. Se
      // deja en el rol de menor `sortOrder` de los que le queden a cada cuenta,
      // igual que hace `setUserRoles`.
      await tx.execute(sql`
        update ${users} u
           set role_id = (
             select ur.role_id from ${userRoles} ur
               join ${roles} r on r.id = ur.role_id
              where ur.user_id = u.id
              order by r.sort_order
              limit 1
           )
         where u.role_id = ${id}
      `);
      await tx.delete(roles).where(eq(roles.id, id));
    });
  } else {
    await db.delete(roles).where(eq(roles.id, id));
  }

  await recordAuditEvent({
    actorUserId: current.id,
    action: "delete",
    entityType: "role_permissions",
    entityId: id,
    metadata: { name: role.name, reassignRoleId: reassignRoleId || null },
  });
  revalidateAppShell();
  return { message: t("roleDeleted") };
}

/**
 * Guarda la matriz roles × permisos: varios roles en un solo envío.
 *
 * El formulario manda dos cosas distintas:
 *
 * - `cell` = `"<roleId>:<permission>"`, una por casilla marcada.
 * - `role` = `"<roleId>"`, un oculto por cada COLUMNA que se haya tocado.
 *
 * La segunda no es opcional. Sin ella, un rol al que se le quitan TODOS los
 * permisos es indistinguible de un rol que no venía en el formulario, y la
 * acción no sabría si vaciarlo o dejarlo en paz. Con la lista explícita la
 * regla es inequívoca: se reemplaza el conjunto de exactamente los roles
 * listados en `role`, y ningún otro se toca. De paso, solo se escribe lo que
 * de verdad ha cambiado.
 */
export async function setPermissionMatrix(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("roles.manage");

  const allRoles = await db.query.roles.findMany();
  const byId = new Map(allRoles.map((r) => [r.id, r]));

  // Fail-closed en dos pasos. Primero los roles: un id que no exista se
  // descarta en silencio, no se crea nada "por si acaso".
  const next = new Map<string, Set<Permission>>();
  for (const raw of formData.getAll("role").map(String)) {
    if (byId.has(raw)) next.set(raw, new Set<Permission>());
  }
  if (next.size === 0) return { message: t("noChanges") };

  // Luego las casillas, filtradas contra el catálogo del CÓDIGO y contra los
  // roles admitidos arriba. Los uuid no llevan `:` y las claves de permiso
  // tampoco (solo puntos), así que el primer `:` parte sin ambigüedad.
  for (const raw of formData.getAll("cell").map(String)) {
    const sep = raw.indexOf(":");
    if (sep < 0) continue;
    const target = next.get(raw.slice(0, sep));
    const permission = raw.slice(sep + 1);
    if (!target || !isPermission(permission)) continue;
    target.add(permission);
  }

  // El rol de administrador no puede quedarse sin poder administrar: es lo
  // único que garantiza que siempre hay una vía de vuelta.
  for (const [roleId, set] of next) {
    if (byId.get(roleId)?.key === "admin") {
      for (const locked of ADMIN_LOCKED_PERMISSIONS) set.add(locked);
    }
  }

  // ¿Me estoy dejando a mí mismo sin poder gestionar roles? Con varios roles,
  // quitárselo a uno es legítimo mientras otro me lo siga dando.
  const myRoleIds = current.assignedRoles.map((r) => r.id);
  const untouched = myRoleIds.filter((id) => !next.has(id));
  const keepsRolesManage =
    myRoleIds.some((id) => next.get(id)?.has("roles.manage")) ||
    (await permissionsOfRoles(untouched)).has("roles.manage");
  if (myRoleIds.length > 0 && !keepsRolesManage) {
    return { error: t("cannotRemoveOwnAdmin") };
  }

  // Y que siga quedando alguien que pueda administrar, evaluado sobre el
  // estado completo resultante y ANTES de escribir nada.
  const remaining = await countActiveAdminsAfter({ rolePermissions: next });
  if (remaining === 0) return { error: t("lastAdminGuard") };

  await db.transaction(async (tx) => {
    for (const [roleId, set] of next) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (set.size > 0) {
        await tx
          .insert(rolePermissions)
          .values([...set].map((permission) => ({ roleId, permission })));
      }
    }
  });

  for (const [roleId, set] of next) {
    await recordAuditEvent({
      actorUserId: current.id,
      action: "update",
      entityType: "role_permissions",
      entityId: roleId,
      metadata: { permissions: [...set] },
    });
  }

  // Un cambio de permisos altera el sidebar de todo el mundo.
  revalidateAppShell();
  return { message: t("permissionsSaved") };
}
