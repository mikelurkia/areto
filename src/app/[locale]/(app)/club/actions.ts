"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { clubSettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";

export type ClubState = {
  error?: string;
  message?: string;
};

/**
 * Guarda la configuración global del club (datos fiscales del emisor de
 * facturas). Tabla singleton: si ya existe una fila la actualizamos, si no la
 * creamos. Solo admin/staff.
 */
export async function updateClubSettings(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requireRole(["admin", "staff"]);

  const values = {
    legalName: String(formData.get("legalName") ?? "").trim() || null,
    taxId: String(formData.get("taxId") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    iban: String(formData.get("iban") ?? "").trim() || null,
    federationCode: String(formData.get("federationCode") ?? "").trim() || null,
    updatedAt: new Date(),
  };

  const existing = await db.query.clubSettings.findFirst({ columns: { id: true } });
  if (existing) {
    await db.update(clubSettings).set(values).where(eq(clubSettings.id, existing.id));
  } else {
    await db.insert(clubSettings).values(values);
  }

  revalidatePath("/", "layout");
  return { message: t("clubDataSaved") };
}
