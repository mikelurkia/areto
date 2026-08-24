import { cache } from "react";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isPermission, type Permission } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** @deprecated Enum viejo de roles. Se elimina al retirar `users.role`. */
export type UserRole = (typeof users.$inferSelect)["role"];
export type UserLocale = (typeof users.$inferSelect)["locale"];
export type UserStatus = (typeof users.$inferSelect)["status"];

/** Rol asignado, tal y como lo necesita la interfaz. `null` = cuenta sin rol. */
export type CurrentUserRole = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  /** @deprecated Usa `permissions` / `hasPermission`. */
  role: UserRole;
  personId: string | null;
  locale: UserLocale;
  status: UserStatus;
  assignedRole: CurrentUserRole | null;
  permissions: ReadonlySet<Permission>;
};

const NO_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>();

/**
 * Usuario autenticado + su perfil (rol, permisos, idioma). Devuelve `null` si no
 * hay sesión.
 *
 * Envuelto en `cache()` de React: la comprobación cuesta una petición HTTP a
 * Supabase Auth más una consulta a `users`, y en cada render la piden el layout,
 * la página y a veces `generateMetadata`. Con `cache()` se ejecuta una sola vez
 * por petición y las siguientes llamadas son gratis.
 *
 * El rol y sus permisos viajan en la MISMA consulta (relación `role` →
 * `permissions`), así que esto no añade ni un viaje más a la base de datos que
 * antes de existir los permisos.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    with: {
      accessRole: {
        with: { permissions: { columns: { permission: true } } },
      },
    },
  });

  const assignedRole = profile?.accessRole
    ? {
        id: profile.accessRole.id,
        key: profile.accessRole.key,
        name: profile.accessRole.name,
        isSystem: profile.accessRole.isSystem,
      }
    : null;

  // Se descarta lo que ya no esté en el catálogo del código: un permiso
  // renombrado o retirado no debe conceder nada (fail-closed).
  const permissions: ReadonlySet<Permission> = profile?.accessRole
    ? new Set(
        profile.accessRole.permissions
          .map((p) => p.permission)
          .filter((p): p is Permission => isPermission(p)),
      )
    : NO_PERMISSIONS;

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    fullName: profile?.fullName ?? null,
    role: profile?.role ?? "member",
    personId: profile?.personId ?? null,
    locale: profile?.locale ?? routing.defaultLocale,
    status: profile?.status ?? "pending",
    assignedRole,
    permissions,
  };
});

/** ¿Tiene el usuario este permiso? Versión pura, para el render. */
export function hasPermission(
  user: Pick<CurrentUser, "permissions"> | null | undefined,
  permission: Permission,
): boolean {
  return user ? user.permissions.has(permission) : false;
}

/** ¿Tiene el usuario alguno de estos permisos? */
export function hasAnyPermission(
  user: Pick<CurrentUser, "permissions"> | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return user ? permissions.some((p) => user.permissions.has(p)) : false;
}

/** Exige sesión. Redirige a /login si no la hay. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale: await getLocale() });
  return user;
}

/**
 * Exige que el usuario tenga uno de los roles indicados.
 *
 * @deprecated En retirada: sustituir por `requirePermission`. Un rol creado por
 * el club nunca estará en una lista escrita a mano, así que esta comprobación
 * deja de ser correcta en cuanto existen roles personalizados.
 */
export async function requireRole(
  roles: UserRole[],
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect({ href: "/dashboard", locale: await getLocale() });
  }
  return user;
}

/**
 * Exige uno de los permisos indicados (basta con tener uno).
 *
 * Redirige al panel si no cumple, igual que hacía `requireRole`: es defensa en
 * profundidad, no un camino que el usuario deba recorrer —la interfaz ya no
 * pinta lo que no puede hacer—. Donde un mensaje de error sí aporta (fallos de
 * ámbito que ocurren de verdad, como un entrenador tocando el partido de otro
 * equipo), el patrón es devolver `{ error: t("notAllowed") }` desde la acción.
 */
export async function requirePermission(
  permission: Permission | Permission[],
): Promise<CurrentUser> {
  const user = await requireUser();
  const needed = Array.isArray(permission) ? permission : [permission];
  if (!hasAnyPermission(user, needed)) {
    redirect({ href: "/dashboard", locale: await getLocale() });
  }
  return user;
}
