"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { clubSettings } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import {
  CLUB_LOGO_PATH,
  CLUB_SEAL_PATH,
  CLUB_SETTINGS_TAG,
  CLUB_SIGNATURE_PATH,
  DOCUMENT_TEMPLATES_BUCKET,
} from "@/lib/club";
import { isValidIban } from "@/lib/iban";
import { resizeImageToPng, resizeImageToWebp } from "@/lib/image-resize";
import { INJURY_REPORT_TEMPLATE_PATH } from "@/lib/injury-report-pdf";
import { readAmountCents } from "@/lib/money";
import { REGISTRATION_AVAILABILITY_TAG } from "@/lib/registration-settings";
import { removeFile, uploadFile } from "@/lib/supabase/storage";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type ClubState = {
  error?: string;
  message?: string;
};

/**
 * UPSERT de la fila singleton de `club_settings`, compartido por todas las
 * acciones de esta pantalla: cada una escribe solo el subconjunto de columnas
 * de su pestaña, así guardar en una no pisa lo que hay en las demás.
 *
 * `updateTag` (no `revalidateTag`) porque quien acaba de guardar tiene que ver
 * su cambio en la siguiente petición, no una versión en caché mientras se
 * refresca por detrás.
 */
async function upsertClubSettings(values: Partial<typeof clubSettings.$inferInsert>) {
  const existing = await db.query.clubSettings.findFirst({ columns: { id: true } });
  if (existing) {
    await db.update(clubSettings).set(values).where(eq(clubSettings.id, existing.id));
  } else {
    await db.insert(clubSettings).values(values);
  }
  updateTag(CLUB_SETTINGS_TAG);
  revalidateRoutes(ROUTE.club);
}

/** Guarda la identidad fiscal del club (pestaña "Datos del club"). */
export async function updateClubIdentity(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  const iban = String(formData.get("iban") ?? "").trim() || null;
  if (iban && !isValidIban(iban)) {
    return { error: t("clubIbanInvalid") };
  }

  await upsertClubSettings({
    legalName: String(formData.get("legalName") ?? "").trim() || null,
    taxId: String(formData.get("taxId") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    iban,
    sepaCreditorId: String(formData.get("sepaCreditorId") ?? "").trim() || null,
    updatedAt: new Date(),
  });
  return { message: t("clubDataSaved") };
}

/** Guarda quién firma los partes y documentos del club (pestaña "Firmantes"). */
export async function updateClubSignatories(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  await upsertClubSettings({
    signatoryName: String(formData.get("signatoryName") ?? "").trim() || null,
    signatoryNationalId:
      String(formData.get("signatoryNationalId") ?? "").trim() || null,
    updatedAt: new Date(),
  });
  return { message: t("clubSignatoriesSaved") };
}

/** Guarda la delegación territorial de la Mutualidad (pestaña "Médico"). */
export async function updateClubMedicalSettings(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  await upsertClubSettings({
    federationDelegation:
      String(formData.get("federationDelegation") ?? "").trim() || null,
    updatedAt: new Date(),
  });
  return { message: t("clubMedicalSaved") };
}

/** Guarda el código de club en la federación (pestaña "Federaciones"). */
export async function updateClubFederationSettings(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  await upsertClubSettings({
    federationCode: String(formData.get("federationCode") ?? "").trim() || null,
    updatedAt: new Date(),
  });
  return { message: t("clubFederationSaved") };
}

/**
 * Abre/cierra los formularios públicos de inscripción y la cuota anual de
 * socio que ambos muestran. Es un ajuste global del club (no de cada
 * temporada: solo hay una activa a la vez), separado del resto de datos del
 * club para no tener que reenviar los datos fiscales solo para tocar un
 * interruptor. Misma tabla singleton que el resto de acciones de club.
 */
export async function updateRegistrationAvailability(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  const memberAnnualFeeCents = readAmountCents(formData.get("memberAnnualFee"));
  if (memberAnnualFeeCents === null || memberAnnualFeeCents < 0) {
    return { error: t("clubMemberAnnualFeeInvalid") };
  }

  await upsertClubSettings({
    playerRegistrationOpen: formData.get("playerRegistrationOpen") === "on",
    memberRegistrationOpen: formData.get("memberRegistrationOpen") === "on",
    memberAnnualFeeCents,
    updatedAt: new Date(),
  });

  // Etiqueta propia además de la del helper: es la que invalida
  // `getRegistrationAvailability`, que lee estas mismas tres columnas.
  updateTag(REGISTRATION_AVAILABILITY_TAG);
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

const MAX_BRANDING_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_BRANDING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Sube (o borra) uno de los tres gráficos del club en una ruta fija del
 * mismo bucket que la plantilla del parte: no hay fila en base de datos que
 * mantener, `getClubBrandingAssets` solo comprueba si el objeto existe.
 */
async function uploadClubBrandingImage(
  formData: FormData,
  fieldName: string,
  path: string,
  resize: (file: File) => Promise<File>,
): Promise<{ error?: string; changed: boolean }> {
  const file = formData.get(fieldName);
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_BRANDING_IMAGE_TYPES.includes(file.type)) {
      return { error: "invalidType", changed: false };
    }
    if (file.size > MAX_BRANDING_IMAGE_BYTES) {
      return { error: "tooLarge", changed: false };
    }
    await uploadFile(DOCUMENT_TEMPLATES_BUCKET, path, await resize(file));
    return { changed: true };
  }
  if (formData.get("remove") === "on") {
    await removeFile(DOCUMENT_TEMPLATES_BUCKET, path);
    return { changed: true };
  }
  return { changed: false };
}

/** Logo del club: se usa en el carné de socio, el recibo de patrocinador y el acta de equipo. */
export async function uploadClubLogo(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  const result = await uploadClubBrandingImage(formData, "logo", CLUB_LOGO_PATH, resizeImageToWebp);
  if (result.error === "invalidType") return { error: t("logoInvalidType") };
  if (result.error === "tooLarge") return { error: t("logoTooLarge") };

  if (result.changed) {
    revalidateRoutes(ROUTE.club);
  }
  return { message: t("clubLogoSaved") };
}

/** Sello del club: se estampa en el parte de lesión y se enseña en el acta de equipo. */
export async function uploadClubSeal(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  const result = await uploadClubBrandingImage(formData, "seal", CLUB_SEAL_PATH, resizeImageToPng);
  if (result.error === "invalidType") return { error: t("logoInvalidType") };
  if (result.error === "tooLarge") return { error: t("logoTooLarge") };

  if (result.changed) {
    revalidateRoutes(ROUTE.club);
  }
  return { message: t("clubSealSaved") };
}

/** Firma del directivo: se estampa en el parte de lesión y se enseña en el acta de equipo. */
export async function uploadClubSignature(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  await requirePermission("club.manage");

  const result = await uploadClubBrandingImage(
    formData,
    "signature",
    CLUB_SIGNATURE_PATH,
    resizeImageToPng,
  );
  if (result.error === "invalidType") return { error: t("logoInvalidType") };
  if (result.error === "tooLarge") return { error: t("logoTooLarge") };

  if (result.changed) {
    revalidateRoutes(ROUTE.club);
  }
  return { message: t("clubSignatureSaved") };
}
