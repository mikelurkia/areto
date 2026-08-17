"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath("/", "layout");
  return { message: t("profileUpdated") };
}

export async function updateEmail(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const t = await getTranslations("Settings");
  await requireUser();

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: t("emailRequired") };

  const origin = getSiteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${origin}/auth/callback` },
  );

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: t("emailChangeRequested") };
}

export async function updatePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const t = await getTranslations("Settings");
  await requireUser();

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) return { error: t("passwordTooShort") };
  if (password !== confirmPassword) return { error: t("passwordMismatch") };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };
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

  if (!isSupabaseAdminConfigured) return { error: t("deleteNotConfigured") };

  // Borra primero el perfil (no hay cascada automática desde auth.users).
  await db.delete(users).where(eq(users.id, user.id));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  const supabase = await createClient();
  await supabase.auth.signOut();

  return redirect({ href: "/", locale: await getLocale() });
}
