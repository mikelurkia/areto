"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { clubSettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { CLUB_SETTINGS_TAG } from "@/lib/club";
import { REGISTRATION_AVAILABILITY_TAG } from "@/lib/registration-settings";

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

  // `updateTag` (no `revalidateTag`) porque quien acaba de guardar tiene que ver
  // su cambio en la siguiente petición, no una versión en caché mientras se
  // refresca por detrás.
  updateTag(CLUB_SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { message: t("clubDataSaved") };
}

/**
 * Abre/cierra los formularios públicos de inscripción. Es un ajuste global
 * del club (no de cada temporada: solo hay una activa a la vez), separado del
 * resto de datos del club para no tener que reenviar los datos fiscales solo
 * para tocar un interruptor. Misma tabla singleton que `updateClubSettings`.
 */
export async function updateRegistrationAvailability(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requireRole(["admin", "staff"]);

  const values = {
    playerRegistrationOpen: formData.get("playerRegistrationOpen") === "on",
    memberRegistrationOpen: formData.get("memberRegistrationOpen") === "on",
    updatedAt: new Date(),
  };

  const existing = await db.query.clubSettings.findFirst({ columns: { id: true } });
  if (existing) {
    await db.update(clubSettings).set(values).where(eq(clubSettings.id, existing.id));
  } else {
    await db.insert(clubSettings).values(values);
  }

  updateTag(CLUB_SETTINGS_TAG);
  updateTag(REGISTRATION_AVAILABILITY_TAG);
  revalidatePath("/", "layout");
  return { message: t("registrationSettingsSaved") };
}
