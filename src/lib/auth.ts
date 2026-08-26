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

export type UserLocale = (typeof users.$inferSelect)["locale"];
export type UserStatus = (typeof users.$inferSelect)["status"];

/** Rol asignado, tal y como lo necesita la interfaz. */
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
  personId: string | null;
  locale: UserLocale;
  status: UserStatus;
  /** Roles de acceso, ordenados por `sortOrder`. Vacío = cuenta sin ninguno. */
  assignedRoles: CurrentUserRole[];
  /** UNIÓN de los permisos de todos sus roles. */
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
 * Los roles y sus permisos viajan en la MISMA consulta (`user_roles` → `roles`
 * → `role_permissions`): las consultas relacionales de Drizzle compilan el
 * anidamiento a una sola sentencia con agregación JSON lateral, así que son
 * cuatro tablas en un viaje, no cuatro viajes.
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
      roleAssignments: {
        with: {
          role: {
            with: { permissions: { columns: { permission: true } } },
          },
        },
      },
    },
  });

  const assignments = profile?.roleAssignments ?? [];

  const assignedRoles: CurrentUserRole[] = assignments
    .map((a) => a.role)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(({ id, key, name, isSystem }) => ({ id, key, name, isSystem }));

  // Unión de los permisos de todos sus roles. Se descarta lo que ya no esté en
  // el catálogo del código: un permiso renombrado o retirado no debe conceder
  // nada (fail-closed).
  const permissions: ReadonlySet<Permission> =
    assignments.length === 0
      ? NO_PERMISSIONS
      : new Set(
          assignments.flatMap((a) =>
            a.role.permissions
              .map((p) => p.permission)
              .filter((p): p is Permission => isPermission(p)),
          ),
        );

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    fullName: profile?.fullName ?? null,
    personId: profile?.personId ?? null,
    locale: profile?.locale ?? routing.defaultLocale,
    status: profile?.status ?? "pending",
    assignedRoles,
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

/**
 * Exige sesión Y cuenta activa. Redirige a /login si no hay sesión, y a
 * /acceso-revocado si la cuenta está desactivada o todavía sin activar.
 *
 * Esta comprobación es la barrera REAL contra una cuenta desactivada: el JWT
 * que el navegador ya tiene sigue siendo válido hasta que caduque, y el proxy
 * no consulta la base de datos (no debe abrir una conexión a Postgres en cada
 * petición). No cuesta nada extra: `getCurrentUser` está en `cache()`.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale: await getLocale() });
  if (user.status !== "active") {
    redirect({ href: "/acceso-revocado", locale: await getLocale() });
  }
  return user;
}

/**
 * Exige uno de los permisos indicados (basta con tener uno).
 *
 * Redirige al panel si no cumple, como hacía la comprobación por roles a la que
 * sustituye: es defensa en profundidad, no un camino que el usuario deba recorrer —la interfaz ya no
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
