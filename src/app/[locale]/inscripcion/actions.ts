"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { registrationGuardians, registrations } from "@/db/schema";
import { isMinor } from "@/lib/age";
import { stampConsent } from "@/lib/consent";
import { isValidIban } from "@/lib/iban";
import { isValidNationalId } from "@/lib/national-id";
import { readGuardians } from "@/lib/registration-guardians";
import { resizeImageToWebp } from "@/lib/image-resize";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { getRegistrationAvailability } from "@/lib/registration-settings";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { extensionFromMimeType, uploadFileAsAdmin } from "@/lib/supabase/storage";

type SubmittedGuardian = {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalId: string;
  address: string;
  phone: string;
  email: string;
};

/** Eco de lo que el usuario había rellenado. React 19 resetea los campos no
 * controlados de un `<form action>` tras CUALQUIER envío (éxito o error), así
 * que sin repoblar desde aquí un solo campo inválido (p. ej. el IBAN) borraría
 * todo lo demás que ya había escrito. */
type SubmittedFields = {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalId: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  iban: string;
  photoConsent: boolean;
  privacyConsent: boolean;
  shirtSize?: string;
  pantsSize?: string;
  shoeSize?: string;
  installmentsChosen?: number;
  sepaConsent?: boolean;
  termsConsent?: boolean;
  guardians: SubmittedGuardian[];
};

export type RegistrationState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  registrationId?: string;
  submitted?: SubmittedFields;
};

const PHOTO_BUCKET = "registration-documents";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Solo para la foto del jugador (no el DNI): miniatura para la comparación en
// la revisión de la inscripción. El original se conserva tal cual, porque si
// se aprueba pasa a ser la foto de la persona (ver `inscripciones/actions.ts`),
// y de ahí se puede descargar a tamaño completo para trámites federativos.
const PHOTO_THUMB_MAX_DIMENSION = 256;

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
    photoConsent: formData.get("photoConsent") === "on",
    privacyConsent: formData.get("privacyConsent") === "on",
  };
}

async function uploadRegistrationPhoto(
  registrationId: string,
  slot: "photo" | "id-front" | "id-back",
  file: File,
): Promise<string> {
  // El DNI (id-front/id-back) se sube tal cual: es un documento que debe
  // seguir siendo legible, no una foto ilustrativa.
  const path = `${registrationId}/${slot}.${extensionFromMimeType(file.type)}`;
  await uploadFileAsAdmin(PHOTO_BUCKET, path, file);
  if (slot === "photo") {
    const thumb = await resizeImageToWebp(file, PHOTO_THUMB_MAX_DIMENSION);
    await uploadFileAsAdmin(PHOTO_BUCKET, personPhotoThumbPath(path), thumb);
  }
  return path;
}

export async function submitTeamRegistration(
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

  const submitted: SubmittedFields = {
    ...fields,
    shirtSize,
    pantsSize,
    shoeSize,
    installmentsChosen,
    sepaConsent,
    termsConsent,
    guardians,
  };

  const errors: Record<string, string> = {};

  if (!fields.firstName) errors.firstName = t("firstNameRequired");
  if (!fields.lastName) errors.lastName = t("lastNameRequired");
  if (!fields.birthDate) errors.birthDate = t("birthDateRequired");
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    errors.nationalId = t("nationalIdInvalid");
  }
  if (!fields.address) errors.address = t("addressRequired");
  if (!fields.city) errors.city = t("cityRequired");
  if (!fields.phone) errors.phone = t("phoneRequired");
  if (!fields.email) errors.email = t("emailRequired");
  if (!shirtSize) errors.shirtSize = t("shirtSizeRequired");
  if (!pantsSize) errors.pantsSize = t("pantsSizeRequired");
  if (!shoeSize) errors.shoeSize = t("shoeSizeRequired");
  if (!fields.iban) errors.iban = t("ibanRequired");
  else if (!isValidIban(fields.iban)) errors.iban = t("ibanInvalid");
  if (!sepaConsent) errors.sepaConsent = t("sepaConsentRequired");
  if (!termsConsent) errors.termsConsent = t("termsConsentRequired");
  if (!fields.privacyConsent) errors.privacyConsent = t("privacyConsentRequired");
  if (!photo) errors.photo = t("photoRequired");
  if (!idFront) errors.idFront = t("idFrontRequired");
  if (!idBack) errors.idBack = t("idBackRequired");
  for (const [key, file] of [
    ["photo", photo],
    ["idFront", idFront],
    ["idBack", idBack],
  ] as const) {
    if (file && (!ALLOWED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES)) {
      errors[key] = t("photoInvalid");
    }
  }
  if (isMinor(fields.birthDate)) {
    if (guardians.length === 0) errors.guardians = t("guardianRequired");
    // Validado por posición en el formulario (no sobre `guardians`, que ya viene filtrado
    // de bloques vacíos) para que cada mensaje señale el mismo bloque visual que lo generó.
    const guardianFirstNames = formData.getAll("guardianFirstName").map((v) => String(v).trim());
    const guardianLastNames = formData.getAll("guardianLastName").map((v) => String(v).trim());
    const guardianBirthDates = formData.getAll("guardianBirthDate").map((v) => String(v).trim());
    const guardianPhones = formData.getAll("guardianPhone").map((v) => String(v).trim());
    const guardianEmails = formData.getAll("guardianEmail").map((v) => String(v).trim());
    const guardianAddresses = formData.getAll("guardianAddress").map((v) => String(v).trim());
    guardianFirstNames.forEach((firstName, i) => {
      const lastName = guardianLastNames[i] ?? "";
      if (!firstName && !lastName) return;
      if (!firstName || !lastName) errors[`guardian-${i}-name`] = t("guardianNameRequired");
      if (!(guardianBirthDates[i] ?? "")) {
        errors[`guardian-${i}-birthDate`] = t("guardianBirthDateRequired");
      }
      if (!(guardianPhones[i] ?? "")) errors[`guardian-${i}-phone`] = t("guardianPhoneRequired");
      if (!(guardianEmails[i] ?? "")) errors[`guardian-${i}-email`] = t("guardianEmailRequired");
      if (!(guardianAddresses[i] ?? "")) {
        errors[`guardian-${i}-address`] = t("guardianAddressRequired");
      }
    });
  }

  if (Object.keys(errors).length > 0) {
    return { error: t("formHasErrors"), fieldErrors: errors, submitted };
  }

  if ((photo || idFront || idBack) && !isSupabaseAdminConfigured) {
    return { error: t("uploadsUnavailable"), submitted };
  }

  const { seasonId, teamRegistrationOpen } = await getRegistrationAvailability();
  if (!seasonId) return { error: t("noActiveSeason"), submitted };
  if (!teamRegistrationOpen) return { error: t("registrationClosed"), submitted };

  try {
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
        sepaConsentAt: stampConsent(sepaConsent),
        termsConsent,
        termsConsentAt: stampConsent(termsConsent),
        photoConsent: fields.photoConsent,
        photoConsentAt: stampConsent(fields.photoConsent),
        privacyConsent: fields.privacyConsent,
        privacyConsentAt: stampConsent(fields.privacyConsent),
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

    return { success: true, registrationId: registration.id };
  } catch (error) {
    // No relanzamos: un fallo aquí (red, Supabase Storage, BD) no debe tirar
    // el error boundary de [locale]/error.tsx, que desmontaría toda la página
    // y borraría lo que el usuario ya había rellenado.
    console.error("submitTeamRegistration failed", error);
    return { error: t("submissionFailed"), submitted };
  }
}

export async function submitMemberRegistration(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const t = await getTranslations("Inscripciones");

  const fields = readCommonFields(formData);
  const sepaConsent = formData.get("sepaConsent") === "on";
  const guardians = readGuardians(formData);

  const submitted: SubmittedFields = { ...fields, sepaConsent, guardians };

  if (!fields.firstName) return { error: t("firstNameRequired"), submitted };
  if (!fields.lastName) return { error: t("lastNameRequired"), submitted };
  if (!fields.birthDate) return { error: t("birthDateRequired"), submitted };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid"), submitted };
  }
  if (!fields.address) return { error: t("addressRequired"), submitted };
  if (!fields.city) return { error: t("cityRequired"), submitted };
  if (!fields.phone) return { error: t("phoneRequired"), submitted };
  if (!fields.email) return { error: t("emailRequired"), submitted };
  if (!fields.iban) return { error: t("ibanRequired"), submitted };
  if (!isValidIban(fields.iban)) return { error: t("ibanInvalid"), submitted };
  if (!sepaConsent) return { error: t("sepaConsentRequired"), submitted };
  if (!fields.privacyConsent) return { error: t("privacyConsentRequired"), submitted };
  // Un menor no puede ser titular de un mandato SEPA (ver `src/lib/payer.ts`):
  // igual que en el alta de jugador, si el solicitante es menor hace falta al
  // menos un tutor, y sus datos deben venir completos.
  if (isMinor(fields.birthDate) && guardians.length === 0) {
    return { error: t("guardianRequired"), submitted };
  }
  for (const g of guardians) {
    if (!g.firstName || !g.lastName) return { error: t("guardianNameRequired"), submitted };
    if (!g.birthDate) return { error: t("guardianBirthDateRequired"), submitted };
    if (!g.phone) return { error: t("guardianPhoneRequired"), submitted };
    if (!g.email) return { error: t("guardianEmailRequired"), submitted };
    if (!g.address) return { error: t("guardianAddressRequired"), submitted };
  }

  const { seasonId, memberOpen } = await getRegistrationAvailability();
  if (!seasonId) return { error: t("noActiveSeason"), submitted };
  if (!memberOpen) return { error: t("registrationClosed"), submitted };

  try {
    const [registration] = await db
      .insert(registrations)
      .values({
        kind: "member",
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
        sepaConsent,
        sepaConsentAt: stampConsent(sepaConsent),
        privacyConsent: fields.privacyConsent,
        privacyConsentAt: stampConsent(fields.privacyConsent),
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

    return { success: true, registrationId: registration.id };
  } catch (error) {
    console.error("submitMemberRegistration failed", error);
    return { error: t("submissionFailed"), submitted };
  }
}
