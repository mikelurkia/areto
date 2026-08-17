"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { registrationGuardians, registrations, seasons } from "@/db/schema";
import { isMinor } from "@/lib/age";
import { isValidNationalId } from "@/lib/national-id";
import { readGuardians } from "@/lib/registration-guardians";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { extensionFromMimeType, uploadFileAsAdmin } from "@/lib/supabase/storage";

export type RegistrationState = {
  error?: string;
  success?: boolean;
};

const PHOTO_BUCKET = "registration-documents";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFile(formData: FormData, key: string): File | null {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

function readCommonFields(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "").trim(),
    nationalId: String(formData.get("nationalId") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    iban: String(formData.get("iban") ?? "").trim(),
    imageConsent: formData.get("imageConsent") === "on",
  };
}

async function resolveCurrentSeasonId(): Promise<string | null> {
  const season = await db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true) });
  return season?.id ?? null;
}

async function uploadRegistrationPhoto(
  registrationId: string,
  slot: "photo" | "id-front" | "id-back",
  file: File,
): Promise<string> {
  const path = `${registrationId}/${slot}.${extensionFromMimeType(file.type)}`;
  await uploadFileAsAdmin(PHOTO_BUCKET, path, file);
  return path;
}

export async function submitPlayerRegistration(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const t = await getTranslations("Inscripciones");

  const fields = readCommonFields(formData);
  const shirtSize = String(formData.get("shirtSize") ?? "").trim();
  const pantsSize = String(formData.get("pantsSize") ?? "").trim();
  const shoeSize = String(formData.get("shoeSize") ?? "").trim();
  const installmentsChosen = Number(formData.get("installmentsChosen") ?? "1") === 2 ? 2 : 1;
  const sepaConsent = formData.get("sepaConsent") === "on";
  const termsConsent = formData.get("termsConsent") === "on";
  const guardians = readGuardians(formData);

  const photo = readFile(formData, "photo");
  const idFront = readFile(formData, "idFront");
  const idBack = readFile(formData, "idBack");

  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (!fields.birthDate) return { error: t("birthDateRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (!fields.address) return { error: t("addressRequired") };
  if (!fields.city) return { error: t("cityRequired") };
  if (!fields.phone) return { error: t("phoneRequired") };
  if (!fields.email) return { error: t("emailRequired") };
  if (!shirtSize) return { error: t("shirtSizeRequired") };
  if (!pantsSize) return { error: t("pantsSizeRequired") };
  if (!shoeSize) return { error: t("shoeSizeRequired") };
  if (!fields.iban) return { error: t("ibanRequired") };
  if (!sepaConsent) return { error: t("sepaConsentRequired") };
  if (!termsConsent) return { error: t("termsConsentRequired") };
  if (!photo) return { error: t("photoRequired") };
  if (!idFront) return { error: t("idFrontRequired") };
  if (!idBack) return { error: t("idBackRequired") };
  for (const file of [photo, idFront, idBack]) {
    if (file && (!ALLOWED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)) {
      return { error: t("photoInvalid") };
    }
  }
  if (isMinor(fields.birthDate)) {
    if (guardians.length === 0) return { error: t("guardianRequired") };
    for (const g of guardians) {
      if (!g.firstName || !g.lastName) return { error: t("guardianNameRequired") };
      if (!g.birthDate) return { error: t("guardianBirthDateRequired") };
      if (!g.phone) return { error: t("guardianPhoneRequired") };
      if (!g.email) return { error: t("guardianEmailRequired") };
      if (!g.address) return { error: t("guardianAddressRequired") };
    }
  }
  if ((photo || idFront || idBack) && !isSupabaseAdminConfigured) {
    return { error: t("uploadsUnavailable") };
  }

  const seasonId = await resolveCurrentSeasonId();
  if (!seasonId) return { error: t("noActiveSeason") };

  const [registration] = await db
    .insert(registrations)
    .values({
      kind: "player",
      seasonId,
      firstName: fields.firstName,
      lastName: fields.lastName,
      birthDate: fields.birthDate,
      nationalId: fields.nationalId || null,
      address: fields.address || null,
      city: fields.city || null,
      phone: fields.phone || null,
      email: fields.email || null,
      iban: fields.iban || null,
      shirtSize: shirtSize || null,
      pantsSize: pantsSize || null,
      shoeSize: shoeSize || null,
      installmentsChosen,
      sepaConsent,
      termsConsent,
      imageConsent: fields.imageConsent,
    })
    .returning({ id: registrations.id });

  if (guardians.length > 0) {
    await db.insert(registrationGuardians).values(
      guardians.map((g, i) => ({
        registrationId: registration.id,
        firstName: g.firstName,
        lastName: g.lastName,
        birthDate: g.birthDate || null,
        nationalId: g.nationalId || null,
        address: g.address || null,
        phone: g.phone || null,
        email: g.email || null,
        sortOrder: i,
      })),
    );
  }

  const [photoPath, idFrontPath, idBackPath] = await Promise.all([
    photo ? uploadRegistrationPhoto(registration.id, "photo", photo) : null,
    idFront ? uploadRegistrationPhoto(registration.id, "id-front", idFront) : null,
    idBack ? uploadRegistrationPhoto(registration.id, "id-back", idBack) : null,
  ]);
  if (photoPath || idFrontPath || idBackPath) {
    await db
      .update(registrations)
      .set({
        photoPath: photoPath ?? undefined,
        idFrontPath: idFrontPath ?? undefined,
        idBackPath: idBackPath ?? undefined,
      })
      .where(eq(registrations.id, registration.id));
  }

  return { success: true };
}

export async function submitCoachRegistration(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const t = await getTranslations("Inscripciones");

  const fields = readCommonFields(formData);
  const photo = readFile(formData, "photo");
  const idFront = readFile(formData, "idFront");
  const idBack = readFile(formData, "idBack");

  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (!fields.birthDate) return { error: t("birthDateRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (!fields.address) return { error: t("addressRequired") };
  if (!fields.city) return { error: t("cityRequired") };
  if (!fields.phone) return { error: t("phoneRequired") };
  if (!fields.email) return { error: t("emailRequired") };
  if (!fields.iban) return { error: t("ibanRequired") };
  if (!photo) return { error: t("photoRequired") };
  if (!idFront) return { error: t("idFrontRequired") };
  if (!idBack) return { error: t("idBackRequired") };
  for (const file of [photo, idFront, idBack]) {
    if (file && (!ALLOWED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)) {
      return { error: t("photoInvalid") };
    }
  }
  if ((photo || idFront || idBack) && !isSupabaseAdminConfigured) {
    return { error: t("uploadsUnavailable") };
  }

  const seasonId = await resolveCurrentSeasonId();
  if (!seasonId) return { error: t("noActiveSeason") };

  const [registration] = await db
    .insert(registrations)
    .values({
      kind: "coach",
      seasonId,
      firstName: fields.firstName,
      lastName: fields.lastName,
      birthDate: fields.birthDate,
      nationalId: fields.nationalId || null,
      address: fields.address || null,
      city: fields.city || null,
      phone: fields.phone || null,
      email: fields.email || null,
      iban: fields.iban || null,
      imageConsent: fields.imageConsent,
    })
    .returning({ id: registrations.id });

  const [photoPath, idFrontPath, idBackPath] = await Promise.all([
    photo ? uploadRegistrationPhoto(registration.id, "photo", photo) : null,
    idFront ? uploadRegistrationPhoto(registration.id, "id-front", idFront) : null,
    idBack ? uploadRegistrationPhoto(registration.id, "id-back", idBack) : null,
  ]);
  if (photoPath || idFrontPath || idBackPath) {
    await db
      .update(registrations)
      .set({
        photoPath: photoPath ?? undefined,
        idFrontPath: idFrontPath ?? undefined,
        idBackPath: idBackPath ?? undefined,
      })
      .where(eq(registrations.id, registration.id));
  }

  return { success: true };
}
