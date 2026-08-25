"use server";

import { randomUUID } from "node:crypto";

import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { registrationGuardians, registrations, registrationSubmissionErrors } from "@/db/schema";
import { isMinor } from "@/lib/age";
import { stampConsent } from "@/lib/consent";
import { isValidIban } from "@/lib/iban";
import { isValidNationalId } from "@/lib/national-id";
import { isValidPostalCode } from "@/lib/postal-code";
import {
  readCommonFields,
  readPlayerFields,
  type RegistrationState,
  type SubmittedFields,
} from "@/lib/registration-form-data";
import { readGuardians } from "@/lib/registration-guardians";
import { resizeImageToWebp } from "@/lib/image-resize";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { getRegistrationAvailability } from "@/lib/registration-settings";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { extensionFromMimeType, uploadFileAsAdmin } from "@/lib/supabase/storage";

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

/** Best-effort: los logs de Vercel de este plan solo retienen un par de
 * minutos, así que sin esto un fallo real (subida a Storage, BD) no deja
 * ningún rastro consultable después del hecho. Si este insert también
 * falla (p. ej. la propia BD es la que está caída) no pasa nada más: el
 * `console.error` de al lado sigue siendo la red de seguridad. */
async function logRegistrationFailure(
  kind: "player" | "member",
  email: string,
  error: unknown,
) {
  try {
    await db.insert(registrationSubmissionErrors).values({
      kind,
      email: email || null,
      message: error instanceof Error ? error.message : String(error),
      detail: error instanceof Error ? (error.stack ?? null) : null,
    });
  } catch (loggingError) {
    console.error("logRegistrationFailure failed", loggingError);
  }
}

export async function submitTeamRegistration(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const t = await getTranslations("Inscripciones");

  // El mismo lector que usa el cliente para rehacer este eco cuando la
  // petición ni siquiera llega aquí (ver `jugador-form.tsx`).
  const submitted = readPlayerFields(formData);
  const {
    shirtSize,
    pantsSize,
    shoeSize,
    installmentsChosen,
    sepaConsent,
    termsConsent,
    guardians,
  } = submitted;

  const photo = readFile(formData, "photo");
  const idFront = readFile(formData, "idFront");
  const idBack = readFile(formData, "idBack");

  const errors: Record<string, string> = {};

  if (!submitted.firstName) errors.firstName = t("firstNameRequired");
  if (!submitted.lastName) errors.lastName = t("lastNameRequired");
  if (!submitted.birthDate) errors.birthDate = t("birthDateRequired");
  if (submitted.nationalId && !isValidNationalId(submitted.nationalId)) {
    errors.nationalId = t("nationalIdInvalid");
  }
  if (!submitted.address) errors.address = t("addressRequired");
  if (!submitted.city) errors.city = t("cityRequired");
  if (!submitted.postalCode) errors.postalCode = t("postalCodeRequired");
  else if (!isValidPostalCode(submitted.postalCode)) {
    errors.postalCode = t("postalCodeInvalid");
  }
  if (!submitted.phone) errors.phone = t("phoneRequired");
  if (!submitted.email) errors.email = t("emailRequired");
  if (!shirtSize) errors.shirtSize = t("shirtSizeRequired");
  if (!pantsSize) errors.pantsSize = t("pantsSizeRequired");
  if (!shoeSize) errors.shoeSize = t("shoeSizeRequired");
  if (!submitted.iban) errors.iban = t("ibanRequired");
  else if (!isValidIban(submitted.iban)) errors.iban = t("ibanInvalid");
  if (!sepaConsent) errors.sepaConsent = t("sepaConsentRequired");
  if (!termsConsent) errors.termsConsent = t("termsConsentRequired");
  if (!submitted.privacyConsent) errors.privacyConsent = t("privacyConsentRequired");
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
  if (isMinor(submitted.birthDate)) {
    if (guardians.length === 0) errors.guardians = t("guardianRequired");
    // Validado por posición en el formulario (no sobre `guardians`, que ya viene filtrado
    // de bloques vacíos) para que cada mensaje señale el mismo bloque visual que lo generó.
    const guardianFirstNames = formData.getAll("guardianFirstName").map((v) => String(v).trim());
    const guardianLastNames = formData.getAll("guardianLastName").map((v) => String(v).trim());
    const guardianBirthDates = formData.getAll("guardianBirthDate").map((v) => String(v).trim());
    const guardianPhones = formData.getAll("guardianPhone").map((v) => String(v).trim());
    const guardianEmails = formData.getAll("guardianEmail").map((v) => String(v).trim());
    const guardianAddresses = formData.getAll("guardianAddress").map((v) => String(v).trim());
    const guardianCities = formData.getAll("guardianCity").map((v) => String(v).trim());
    const guardianPostalCodes = formData
      .getAll("guardianPostalCode")
      .map((v) => String(v).trim());
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
      if (!(guardianCities[i] ?? "")) errors[`guardian-${i}-city`] = t("guardianCityRequired");
      const guardianPostalCode = guardianPostalCodes[i] ?? "";
      if (!guardianPostalCode) {
        errors[`guardian-${i}-postalCode`] = t("guardianPostalCodeRequired");
      } else if (!isValidPostalCode(guardianPostalCode)) {
        errors[`guardian-${i}-postalCode`] = t("postalCodeInvalid");
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

  // Generado aquí (en vez de dejar que `registrations.id` lo genere el
  // default de la columna) para poder subir las fotos ANTES del insert: así,
  // si la subida falla, no queda ninguna fila en `registrations` a medias —
  // el peor caso posible es un fichero huérfano en Storage, invisible para
  // el resto de la app.
  const registrationId = randomUUID();

  try {
    const [photoPath, idFrontPath, idBackPath] = await Promise.all([
      photo ? uploadRegistrationPhoto(registrationId, "photo", photo) : null,
      idFront ? uploadRegistrationPhoto(registrationId, "id-front", idFront) : null,
      idBack ? uploadRegistrationPhoto(registrationId, "id-back", idBack) : null,
    ]);

    // Un solo insert con las rutas ya conocidas: no hace falta un `update`
    // posterior, y el insert de tutores va en la misma transacción para que
    // un jugador menor nunca se quede sin ellos si algo falla a mitad.
    await db.transaction(async (tx) => {
      await tx.insert(registrations).values({
        id: registrationId,
        kind: "player",
        seasonId,
        firstName: submitted.firstName,
        lastName: submitted.lastName,
        birthDate: submitted.birthDate,
        nationalId: submitted.nationalId || null,
        address: submitted.address || null,
        city: submitted.city || null,
        postalCode: submitted.postalCode || null,
        phone: submitted.phone || null,
        email: submitted.email || null,
        iban: submitted.iban || null,
        shirtSize: shirtSize || null,
        pantsSize: pantsSize || null,
        shoeSize: shoeSize || null,
        installmentsChosen,
        sepaConsent,
        sepaConsentAt: stampConsent(sepaConsent),
        termsConsent,
        termsConsentAt: stampConsent(termsConsent),
        photoConsent: submitted.photoConsent,
        photoConsentAt: stampConsent(submitted.photoConsent),
        privacyConsent: submitted.privacyConsent,
        privacyConsentAt: stampConsent(submitted.privacyConsent),
        photoPath,
        idFrontPath,
        idBackPath,
      });

      if (guardians.length > 0) {
        await tx.insert(registrationGuardians).values(
          guardians.map((g, i) => ({
            registrationId,
            firstName: g.firstName,
            lastName: g.lastName,
            birthDate: g.birthDate || null,
            nationalId: g.nationalId || null,
            address: g.address || null,
            city: g.city || null,
            postalCode: g.postalCode || null,
            phone: g.phone || null,
            email: g.email || null,
            sortOrder: i,
          })),
        );
      }
    });

    return { success: true, registrationId };
  } catch (error) {
    // No relanzamos: un fallo aquí (red, Supabase Storage, BD) no debe tirar
    // el error boundary de inscripcion/error.tsx, que desmontaría toda la
    // página y borraría lo que el usuario ya había rellenado.
    console.error("submitTeamRegistration failed", error);
    await logRegistrationFailure("player", submitted.email, error);
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
  if (!fields.postalCode) return { error: t("postalCodeRequired"), submitted };
  if (!isValidPostalCode(fields.postalCode)) {
    return { error: t("postalCodeInvalid"), submitted };
  }
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
    if (!g.city) return { error: t("guardianCityRequired"), submitted };
    if (!g.postalCode) return { error: t("guardianPostalCodeRequired"), submitted };
    if (!isValidPostalCode(g.postalCode)) return { error: t("postalCodeInvalid"), submitted };
  }

  const { seasonId, memberOpen } = await getRegistrationAvailability();
  if (!seasonId) return { error: t("noActiveSeason"), submitted };
  if (!memberOpen) return { error: t("registrationClosed"), submitted };

  const registrationId = randomUUID();

  try {
    // Transacción: sin fotos que subir aquí, el único riesgo de fila a
    // medias es un jugador menor que se quede sin sus tutores.
    await db.transaction(async (tx) => {
      await tx.insert(registrations).values({
        id: registrationId,
        kind: "member",
        seasonId,
        firstName: fields.firstName,
        lastName: fields.lastName,
        birthDate: fields.birthDate,
        nationalId: fields.nationalId || null,
        address: fields.address || null,
        city: fields.city || null,
        postalCode: fields.postalCode || null,
        phone: fields.phone || null,
        email: fields.email || null,
        iban: fields.iban || null,
        sepaConsent,
        sepaConsentAt: stampConsent(sepaConsent),
        privacyConsent: fields.privacyConsent,
        privacyConsentAt: stampConsent(fields.privacyConsent),
      });

      if (guardians.length > 0) {
        await tx.insert(registrationGuardians).values(
          guardians.map((g, i) => ({
            registrationId,
            firstName: g.firstName,
            lastName: g.lastName,
            birthDate: g.birthDate || null,
            nationalId: g.nationalId || null,
            address: g.address || null,
            city: g.city || null,
            postalCode: g.postalCode || null,
            phone: g.phone || null,
            email: g.email || null,
            sortOrder: i,
          })),
        );
      }
    });

    return { success: true, registrationId };
  } catch (error) {
    console.error("submitMemberRegistration failed", error);
    await logRegistrationFailure("member", fields.email, error);
    return { error: t("submissionFailed"), submitted };
  }
}
