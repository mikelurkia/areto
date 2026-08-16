"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { users } from "@/db/schema";
import { routing, type Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth";

/** Guarda el idioma preferido del usuario (persiste entre dispositivos). */
export async function updateLocale(locale: Locale) {
  if (!routing.locales.includes(locale)) return;

  const user = await requireUser();
  await db.update(users).set({ locale }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}
