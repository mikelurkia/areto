"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect as localizedRedirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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
  if (!isSupabaseConfigured) return { error: t("notConfigured") };

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: t("invalidCredentials") };

  revalidatePath("/", "layout");
  const current = await getCurrentUser();
  const locale = current?.locale ?? routing.defaultLocale;
  return localizedRedirect({ href: next, locale });
}

/**
 * El alta pública está cerrada: al club se entra por invitación, desde
 * /administracion/usuarios.
 *
 * La acción no se borra, se convierte en un cortafuegos. La barrera de verdad
 * está en Supabase ("Allow new users to sign up" apagado, ver
 * `supabase/setup.sql`); esto solo evita que una petición reconstruida a mano
 * llegue a intentarlo, y deja escrito por qué el formulario ya no la ofrece.
 */
export async function signup(): Promise<AuthState> {
  const t = await getTranslations("AuthErrors");
  return { error: t("signupDisabled") };
}

/**
 * "He olvidado mi contraseña", pedido por el propio usuario.
 *
 * Aquí sí va el cliente de sesión: quien rellena el formulario es quien va a
 * abrir el correo. (Cuando lo lanza un administrador desde la pantalla de
 * usuarios se usa el cliente de administración, para no dejar el verificador
 * PKCE en el navegador equivocado.)
 *
 * Responde lo mismo exista o no la cuenta: si no, esta pantalla se convertiría
 * en una forma cómoda de averiguar quién tiene cuenta en el club.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("Login");
  const tErrors = await getTranslations("AuthErrors");
  if (!isSupabaseConfigured) return { error: tErrors("notConfigured") };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: t("emailRequired") };

  const origin = getSiteUrl();
  const next = encodeURIComponent("/contrasena?motivo=recuperacion");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${next}`,
  });

  return { message: t("resetEmailSent") };
}

/**
 * Fija la contraseña tras aceptar una invitación o pedir una recuperación.
 *
 * Llega aquí con sesión ya iniciada: `/auth/confirm` la ha abierto al canjear
 * el token del correo.
 */
export async function setPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("Login");
  const tErrors = await getTranslations("AuthErrors");
  if (!isSupabaseConfigured) return { error: tErrors("notConfigured") };

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) return { error: tErrors("passwordTooShort") };
  if (password !== confirmPassword) return { error: t("passwordMismatch") };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  const current = await getCurrentUser();
  const locale = current?.locale ?? routing.defaultLocale;
  return localizedRedirect({ href: "/dashboard", locale });
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
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { redirectTo: `/${await getLocale()}` };
}
