"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { clubSettings } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { CLUB_SETTINGS_TAG } from "@/lib/club";
import { isValidIban } from "@/lib/iban";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
} from "@/lib/injury-report-pdf";
import { REGISTRATION_AVAILABILITY_TAG } from "@/lib/registration-settings";
import { uploadFile } from "@/lib/supabase/storage";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

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
  await requirePermission("club.manage");

  const iban = String(formData.get("iban") ?? "").trim() || null;
  if (iban && !isValidIban(iban)) {
    return { error: t("clubIbanInvalid") };
  }

  const values = {
    legalName: String(formData.get("legalName") ?? "").trim() || null,
    taxId: String(formData.get("taxId") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    iban,
    federationCode: String(formData.get("federationCode") ?? "").trim() || null,
    federationDelegation:
      String(formData.get("federationDelegation") ?? "").trim() || null,
    signatoryName: String(formData.get("signatoryName") ?? "").trim() || null,
    signatoryNationalId:
      String(formData.get("signatoryNationalId") ?? "").trim() || null,
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
  revalidateRoutes(ROUTE.club);
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
  await requirePermission("club.manage");

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
  revalidateRoutes(ROUTE.club);
  return { message: t("registrationSettingsSaved") };
}

const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Sustituye la plantilla del parte de lesión de la Mutualidad.
 *
 * Es un único fichero global (ni por temporada ni por equipo) en una ruta fija
 * del bucket, así que subir una nueva sobreescribe la anterior: no hay historial
 * ni fila en base de datos que mantener. Se exige PDF porque
 * `fillInjuryReportPdf` rellena su AcroForm; una imagen escaneada no serviría.
 */
export async function uploadInjuryReportTemplate(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  const file = formData.get("template");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t("injuryTemplateFileRequired") };
  }
  if (file.type !== "application/pdf") {
    return { error: t("injuryTemplateFileInvalidType") };
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return { error: t("injuryTemplateFileTooLarge") };
  }

  await uploadFile(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH, file);

  revalidateRoutes(ROUTE.club);
  return { message: t("injuryTemplateSaved") };
}
