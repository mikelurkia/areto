import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type UserRole = (typeof users.$inferSelect)["role"];
export type UserLocale = (typeof users.$inferSelect)["locale"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  personId: string | null;
  locale: UserLocale;
};

/**
 * Usuario autenticado + su perfil (rol, club, idioma). Devuelve `null` si no hay sesión.
 * El rol/idioma se leen de la tabla de perfil `users` (poblada por el trigger de Supabase).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    fullName: profile?.fullName ?? null,
    role: profile?.role ?? "member",
    personId: profile?.personId ?? null,
    locale: profile?.locale ?? routing.defaultLocale,
  };
}

/** Exige sesión. Redirige a /login si no la hay. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale: await getLocale() });
  return user;
}

/**
 * Exige que el usuario tenga uno de los roles indicados.
 * Redirige al panel si no cumple (autorización a nivel de servidor).
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
