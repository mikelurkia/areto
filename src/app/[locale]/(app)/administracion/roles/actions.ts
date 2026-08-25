"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { rolePermissions, roles, users } from "@/db/schema";
import { countActiveAdmins, getRolePermissions } from "@/lib/admin-guards";
import { requirePermission } from "@/lib/auth";
import { UNIQUE_VIOLATION, isPostgresError } from "@/lib/db-errors";
import {
  ADMIN_LOCKED_PERMISSIONS,
  isPermission,
  type Permission,
} from "@/lib/permissions";

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
  await requirePermission("roles.manage");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const copyFromRoleId = String(formData.get("copyFromRoleId") ?? "").trim();
  const makeDefault = formData.get("makeDefault") === "on";

  if (!name) return { error: t("roleNameRequired") };
  if (name.length > 60) return { error: t("roleNameTooLong") };

  const key = slugify(name);
  if (!key) return { error: t("roleNameInvalid") };

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

  revalidatePath("/", "layout");
  return { message: t("roleCreated") };
}

export async function updateRole(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  await requirePermission("roles.manage");

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

  revalidatePath("/", "layout");
  return { message: t("roleUpdated") };
}

export async function deleteRole(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  await requirePermission("roles.manage");

  const id = String(formData.get("id") ?? "");
  const reassignRoleId = String(formData.get("reassignRoleId") ?? "").trim();

  const role = await db.query.roles.findFirst({ where: eq(roles.id, id) });
  if (!role) return { error: t("roleNotFound") };
  if (role.isSystem) return { error: t("cannotDeleteSystemRole") };
  if (role.isDefault) return { error: t("cannotDeleteDefaultRole") };

  const assigned = await db.query.users.findMany({
    where: eq(users.roleId, id),
    columns: { id: true },
  });

  if (assigned.length > 0) {
    if (!reassignRoleId) {
      return { error: t("roleHasUsers", { count: assigned.length }) };
    }
    const target = await db.query.roles.findFirst({
      where: and(eq(roles.id, reassignRoleId), ne(roles.id, id)),
    });
    if (!target) return { error: t("reassignRoleRequired") };

    // Si el rol que desaparece era el que sostenía la administración y el
    // destino no lo hace, el club se quedaría sin nadie que pueda entrar aquí.
    const targetPermissions = await getRolePermissions(target.id);
    if (!targetPermissions.has("usuarios.manage")) {
      const remaining = await countActiveAdmins({ excludeRoleId: id });
      if (remaining === 0) return { error: t("lastAdminGuard") };
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ roleId: target.id }).where(eq(users.roleId, id));
      await tx.delete(roles).where(eq(roles.id, id));
    });
  } else {
    await db.delete(roles).where(eq(roles.id, id));
  }

  revalidatePath("/", "layout");
  return { message: t("roleDeleted") };
}

export async function setRolePermissions(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  const t = await getTranslations("Administracion");
  const current = await requirePermission("roles.manage");

  const roleId = String(formData.get("roleId") ?? "");
  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) return { error: t("roleNotFound") };

  // Se filtra contra el catálogo del código: lo que llegue por el formulario y
  // no exista como permiso se descarta, no se guarda "por si acaso".
  const submitted = new Set<Permission>(
    formData
      .getAll("permissions")
      .map(String)
      .filter((p): p is Permission => isPermission(p)),
  );

  // El rol de administrador no puede quedarse sin poder administrar: es el
  // único que garantiza que siempre hay una vía de vuelta.
  if (role.key === "admin") {
    for (const locked of ADMIN_LOCKED_PERMISSIONS) submitted.add(locked);
  }

  const isOwnRole = current.assignedRole?.id === roleId;
  if (isOwnRole && !submitted.has("roles.manage")) {
    return { error: t("cannotRemoveOwnAdmin") };
  }

  // Si este rol deja de conceder la administración, tiene que quedar alguien
  // más que la tenga.
  if (!submitted.has("usuarios.manage")) {
    const remaining = await countActiveAdmins({ excludeRoleId: roleId });
    if (remaining === 0) return { error: t("lastAdminGuard") };
  }

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (submitted.size > 0) {
      await tx
        .insert(rolePermissions)
        .values([...submitted].map((permission) => ({ roleId, permission })));
    }
  });

  revalidatePath("/", "layout");
  return { message: t("permissionsSaved") };
}
