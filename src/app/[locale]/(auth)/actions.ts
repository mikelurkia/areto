"use server";

import { redirect } from "next/navigation";
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

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("AuthErrors");
  if (!isSupabaseConfigured) return { error: t("notConfigured") };

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: t("passwordTooShort") };
  }

  const origin = getSiteUrl();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: error.message };

  // Si la confirmación por email está activada, no hay sesión todavía.
  if (!data.session) {
    return { message: t("accountCreated") };
  }

  revalidatePath("/", "layout");
  const current = await getCurrentUser();
  const locale = current?.locale ?? routing.defaultLocale;
  return localizedRedirect({ href: "/dashboard", locale });
}

export async function signInWithGoogle(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getTranslations("AuthErrors");
  if (!isSupabaseConfigured) return { error: t("notConfigured") };

  const next = safeNext(formData.get("next"));
  const origin = getSiteUrl();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: error.message };
  // URL externa (accounts.google.com): redirect "plano", no el localizado.
  if (data.url) redirect(data.url);
  return { error: t("googleFailed") };
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
 */
export async function logout(): Promise<{ redirectTo: string }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { redirectTo: `/${await getLocale()}/login` };
}
