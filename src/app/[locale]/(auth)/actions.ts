"use server";

import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { redirect as localizedRedirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { isSmtpConfigured, sendAuthEmail } from "@/lib/auth-email";
import { createPasswordLink } from "@/lib/auth-links";
import { auth } from "@/lib/better-auth";
import { isLoginRateLimited } from "@/lib/login-rate-limit";

export type AuthState = {
  error?: string;
  message?: string;
};

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Solo rutas relativas internas, para evitar open redirects.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("AuthErrors");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (await isLoginRateLimited(email)) return { error: t("tooManyAttempts") };

  let userId: string;
  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch {
    // Contraseña mala, cuenta inexistente o desactivada: el mismo mensaje, para
    // no revelar cuál de las tres.
    return { error: t("invalidCredentials") };
  }

  // La cookie recién escrita no está en las cabeceras de esta petición, así
  // que el idioma se lee directamente y no con `getCurrentUser`.
  const profile = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { locale: true },
  });
  const locale = profile?.locale ?? routing.defaultLocale;
  return localizedRedirect({ href: next, locale });
}

/**
 * El alta pública está cerrada: al club se entra por invitación, desde
 * /administracion/usuarios.
 *
 * La acción no se borra, se convierte en un cortafuegos. La barrera de verdad
 * es `disableSignUp` en `src/lib/better-auth.ts`; esto solo evita que una
 * petición reconstruida a mano llegue a intentarlo, y deja escrito por qué el
 * formulario ya no la ofrece.
 */
export async function signup(): Promise<AuthState> {
  const t = await getTranslations("AuthErrors");
  return { error: t("signupDisabled") };
}

/**
 * "He olvidado mi contraseña", pedido por el propio usuario.
 *
 * Sin SMTP no hay forma de hacerle llegar el enlace, así que se le manda a un
 * administrador, que puede generarlo desde la pantalla de usuarios.
 *
 * Con SMTP responde lo mismo exista o no la cuenta: si no, esta pantalla se
 * convertiría en una forma cómoda de averiguar quién tiene cuenta en el club.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("Login");
  const tErrors = await getTranslations("AuthErrors");

  if (!isSmtpConfigured) return { error: t("resetContactAdmin") };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: t("emailRequired") };

  // Comparte el límite del login: sin él, esto serviría para bombardear un buzón.
  if (await isLoginRateLimited(email)) return { error: tErrors("tooManyAttempts") };

  const target = await db.query.users.findFirst({
    where: and(eq(users.email, email), ne(users.status, "disabled")),
    columns: { id: true, email: true },
  });
  if (target) {
    await sendAuthEmail(
      "recovery",
      target.email,
      await createPasswordLink(target.id, "recovery"),
    );
  }

  return { message: t("resetEmailSent") };
}

/**
 * Fija la contraseña tras aceptar una invitación o pedir una recuperación, con
 * el token de un solo uso del enlace, y abre la sesión.
 */
export async function setPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("Login");
  const tErrors = await getTranslations("AuthErrors");

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) return { error: tErrors("passwordTooShort") };
  if (password !== confirmPassword) return { error: t("passwordMismatch") };

  // El token dice de quién es la cuenta; hace falta su correo para abrirle la
  // sesión después, porque `resetPassword` solo cambia la contraseña.
  const ctx = await auth.$context;
  const verification = token
    ? await ctx.internalAdapter.findVerificationValue(`reset-password:${token}`)
    : null;
  const target =
    verification && verification.expiresAt > new Date()
      ? await db.query.users.findFirst({
          where: eq(users.id, verification.value),
          columns: { id: true, email: true, locale: true },
        })
      : undefined;
  if (!target) return { error: tErrors("invalidLink") };

  try {
    await auth.api.resetPassword({ body: { token, newPassword: password } });
  } catch {
    return { error: tErrors("invalidLink") };
  }

  // Quien llega con el enlace demuestra que el correo es suyo.
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, target.id));

  try {
    await auth.api.signInEmail({
      body: { email: target.email, password },
      headers: await headers(),
    });
  } catch {
    // Una cuenta desactivada puede fijar contraseña, pero no entra.
    return localizedRedirect({ href: "/acceso-revocado", locale: target.locale });
  }

  return localizedRedirect({ href: "/dashboard", locale: target.locale });
}

/**
 * Cierra la sesión y devuelve a dónde ir. No redirige por su cuenta a propósito:
 * quien la llama hace una navegación completa del navegador.
 *
 * Con Cache Components, React conserva las pantallas visitadas montadas
 * (`<Activity>`), así que una navegación cliente dejaría en memoria el estado del
 * usuario anterior —borradores en diálogos, filtros de tablas—. Una recarga
 * completa lo descarta todo, que es lo que se espera al salir de una cuenta en un
 * ordenador compartido del club.
 *
 * Va a la web pública (`/`), no a `/login`: quien cierra sesión no está
 * necesariamente a punto de volver a entrar.
 */
export async function logout(): Promise<{ redirectTo: string }> {
  await auth.api.signOut({ headers: await headers() });
  return { redirectTo: `/${await getLocale()}` };
}
