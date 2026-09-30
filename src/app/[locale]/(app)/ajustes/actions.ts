"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { countActiveAdminsAfter } from "@/lib/admin-guards";
import { requireUser } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/auth-email";
import { auth } from "@/lib/better-auth";
import { revalidateAppShell } from "@/lib/revalidate";

export type SettingsState = {
  error?: string;
  message?: string;
};

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const t = await getTranslations("Settings");
  const user = await requireUser();

  const fullName = String(formData.get("fullName") ?? "").trim();

  await db
    .update(users)
    .set({ fullName: fullName || null })
    .where(eq(users.id, user.id));

  revalidateAppShell();
  return { message: t("profileUpdated") };
}

export async function updateEmail(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const t = await getTranslations("Settings");
  await requireUser();

  // Sin SMTP el formulario ni se ofrece: esto es para una petición a mano.
  if (!isSmtpConfigured) return { error: t("emailChangeUnavailable") };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: t("emailRequired") };

  // El correo no cambia hasta que se pulsa el enlace que llega a la dirección
  // nueva; entonces lo cambia el endpoint de Better Auth y vuelve a ajustes.
  try {
    await auth.api.changeEmail({
      body: { newEmail: email, callbackURL: `/${await getLocale()}/ajustes` },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[ajustes] changeEmail:", error);
    return { error: t("emailChangeFailed") };
  }
  return { message: t("emailChangeRequested") };
}

export async function updatePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const t = await getTranslations("Settings");
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) return { error: t("passwordTooShort") };
  if (password !== confirmPassword) return { error: t("passwordMismatch") };

  // Como hasta ahora, basta con la sesión abierta: no se pide la actual.
  // (`auth.api.changePassword` la exigiría.)
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(password));

  return { message: t("passwordUpdated") };
}

export async function deleteAccount(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const t = await getTranslations("Settings");
  const user = await requireUser();

  const confirmEmail = String(formData.get("confirmEmail") ?? "").trim();
  if (confirmEmail !== user.email) return { error: t("deleteConfirmMismatch") };

  // La misma guarda que en /administracion, y por el mismo motivo: borrarse la
  // cuenta es otra manera —la única que quedaba sin cubrir— de dejar al club
  // sin nadie que pueda administrar la aplicación. `deleteUser` no puede
  // taparla: se niega a borrar la cuenta de quien la ejecuta.
  const remainingAdmins = await countActiveAdminsAfter({
    userRoles: new Map([[user.id, null]]),
  });
  if (remainingAdmins === 0) return { error: t("deleteLastAdminGuard") };

  // Primero se cierra la sesión, que además borra la cookie; el borrado de
  // `users` se lleva en cascada sus sesiones y su contraseña.
  await auth.api.signOut({ headers: await headers() });
  await db.delete(users).where(eq(users.id, user.id));

  return redirect({ href: "/", locale: await getLocale() });
}
