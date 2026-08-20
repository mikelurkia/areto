"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  clubMembers,
  memberships,
  personDocuments,
  personGuardians,
  personInjuryReports,
  personMedicalCheckups,
  personNotes,
  personQualifications,
  personTags,
  persons,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { nextConsentAt, stampConsent } from "@/lib/consent";
import { makeDocumentActions } from "@/lib/entity-documents";
import { makeNoteActions } from "@/lib/entity-notes";
import { isValidIban } from "@/lib/iban";
import { isValidNationalId } from "@/lib/national-id";
import { findCandidates } from "@/lib/person-matching";
import { resolvePayerFields } from "@/lib/payer";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";
import type { PersonCandidate } from "@/components/match-select";

export type PersonState = {
  error?: string;
  message?: string;
  /** Presente cuando `createPerson` encuentra alguien parecido y espera que el
   * usuario elija "vincular" o "crear de todas formas" antes de continuar. */
  candidates?: PersonCandidate[];
  submittedFields?: Record<string, string | null>;
};

const MANAGE_ROLES = ["admin", "staff"] as const;

const PHOTO_BUCKET = "person-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function uploadPersonPhoto(personId: string, file: File): Promise<string> {
  const path = `${personId}/photo.${extensionFromMimeType(file.type)}`;
  await uploadFile(PHOTO_BUCKET, path, file);
  return path;
}

async function removePersonPhotoObject(path: string) {
  await removeFile(PHOTO_BUCKET, path);
}

const QUALIFICATIONS_BUCKET = "person-qualifications";
const MAX_QUALIFICATION_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_QUALIFICATION_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

async function uploadQualificationFile(
  personId: string,
  qualificationId: string,
  file: File,
): Promise<string> {
  const path = `${personId}/${qualificationId}.${extensionFromMimeType(file.type)}`;
  await uploadFile(QUALIFICATIONS_BUCKET, path, file);
  return path;
}

async function removeQualificationFileObject(path: string) {
  await removeFile(QUALIFICATIONS_BUCKET, path);
}

const MEDICAL_CHECKUPS_BUCKET = "person-medical-checkups";
const INJURY_REPORTS_BUCKET = "person-injury-reports";
const MAX_MEDICAL_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MEDICAL_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

async function uploadMedicalCheckupFile(
  personId: string,
  checkupId: string,
  file: File,
): Promise<string> {
  const path = `${personId}/${checkupId}.${extensionFromMimeType(file.type)}`;
  await uploadFile(MEDICAL_CHECKUPS_BUCKET, path, file);
  return path;
}

async function removeMedicalCheckupFileObject(path: string) {
  await removeFile(MEDICAL_CHECKUPS_BUCKET, path);
}

async function uploadInjuryReportFile(
  personId: string,
  reportId: string,
  file: File,
): Promise<string> {
  const path = `${personId}/${reportId}.${extensionFromMimeType(file.type)}`;
  await uploadFile(INJURY_REPORTS_BUCKET, path, file);
  return path;
}

async function removeInjuryReportFileObject(path: string) {
  await removeFile(INJURY_REPORTS_BUCKET, path);
}

/**
 * `persons.medical_cert_until` no se edita a mano: se deriva del reconocimiento
 * médico más reciente (por `occurred_on`) cada vez que cambia el historial de
 * reconocimientos, para que las alertas de plantilla/acta/dashboard que ya
 * leen esa columna sigan funcionando sin tocarlas.
 */
async function recomputeMedicalCertUntil(personId: string) {
  const latest = await db.query.personMedicalCheckups.findFirst({
    where: eq(personMedicalCheckups.personId, personId),
    orderBy: (m, { desc }) => [desc(m.occurredOn)],
    columns: { expiresOn: true },
  });
  await db
    .update(persons)
    .set({ medicalCertUntil: latest?.expiresOn ?? null })
    .where(eq(persons.id, personId));
}

/** Ids de tutor enviados por el diálogo como lista separada por comas (ver `guardianIds` hidden input). */
function readGuardianIds(formData: FormData, excludeId?: string): string[] {
  const raw = String(formData.get("guardianIds") ?? "").trim();
  if (!raw) return [];
  const ids = raw.split(",").map((id) => id.trim()).filter(Boolean);
  return [...new Set(ids)].filter((id) => id !== excludeId);
}

/** Reemplaza los tutores de una persona: borra los actuales e inserta los nuevos (el primero, principal). */
async function replaceGuardians(personId: string, guardianIds: string[]) {
  await db.delete(personGuardians).where(eq(personGuardians.personId, personId));
  if (guardianIds.length === 0) return;
  await db.insert(personGuardians).values(
    guardianIds.map((guardianId, i) => ({
      personId,
      guardianId,
      isPrimary: i === 0,
    })),
  );
}

function readMemberNumber(formData: FormData): number | null {
  const raw = String(formData.get("memberNumber") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Nombre de la restricción única que violó un error de Postgres (23505), o
 * `null` si no es ese tipo de error. El driver `postgres-js` expone el
 * nombre real como `constraint_name` (no `constraint`), y Drizzle envuelve el
 * error real en `.cause` en vez de dejarlo en el nivel superior — verificado
 * contra la BD real, mismo tipo de envoltorio ya visto para el borrado
 * protegido por FK en otras acciones de este proyecto.
 */
function uniqueViolationConstraint(error: unknown): string | null {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      "code" in candidate &&
      (candidate as { code?: unknown }).code === "23505"
    ) {
      return (candidate as { constraint_name?: string }).constraint_name ?? null;
    }
  }
  return null;
}

/** Mensaje de error a mostrar según qué restricción única de `persons`/`club_members` chocó. */
function uniqueViolationMessage(
  error: unknown,
  t: (key: string) => string,
): string | null {
  const constraint = uniqueViolationConstraint(error);
  if (constraint === "club_members_member_number_idx") return t("memberNumberTaken");
  if (constraint === "persons_national_id_idx") return t("nationalIdTaken");
  if (constraint === "persons_email_idx") return t("emailTaken");
  return null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sincroniza la condición de socio (tabla `club_members`) con el checkbox y
 * el nº del formulario de persona. Alta = upsert a `active` (crea la fila si
 * no existía); baja = cancela sin borrar, para conservar el histórico y el nº
 * ya asignado (no se reutiliza).
 */
async function syncClubMembership(
  personId: string,
  isMember: boolean,
  memberNumber: number | null,
) {
  const existing = await db.query.clubMembers.findFirst({
    where: eq(clubMembers.personId, personId),
  });
  if (isMember) {
    if (existing) {
      await db
        .update(clubMembers)
        .set({ status: "active", memberNumber, cancelledAt: null })
        .where(eq(clubMembers.id, existing.id));
    } else {
      await db.insert(clubMembers).values({
        personId,
        status: "active",
        memberNumber,
        joinedAt: today(),
      });
    }
  } else if (existing && existing.status === "active") {
    await db
      .update(clubMembers)
      .set({ status: "cancelled", cancelledAt: today() })
      .where(eq(clubMembers.id, existing.id));
  }
}

function readPersonFields(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "").trim(),
    nationalId: String(formData.get("nationalId") ?? "").trim(),
    isMember: formData.get("isMember") === "on",
    memberNumber: readMemberNumber(formData),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    iban: String(formData.get("iban") ?? "").trim(),
    shirtSize: String(formData.get("shirtSize") ?? "").trim(),
    pantsSize: String(formData.get("pantsSize") ?? "").trim(),
    shoeSize: String(formData.get("shoeSize") ?? "").trim(),
    // photoConsent y sepaConsent NO son editables aquí a propósito: deben
    // reflejar siempre fielmente lo que la persona autorizó al inscribirse
    // (ver `updateRegistration`), no lo que teclee el staff en esta ficha.
    removePhoto: formData.get("removePhoto") === "on",
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function readPhoto(formData: FormData): File | null {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

/** Campos usados para detectar/comparar posibles duplicados al crear a mano
 * (mismo criterio que `PERSON_DIFF_FIELDS` en la revisión de inscripciones). */
const PERSON_MATCH_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "phone",
  "email",
  "iban",
  "shirtSize",
  "pantsSize",
  "shoeSize",
] as const;

export async function createPerson(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  // El usuario ya vio los candidatos (ver más abajo) y decidió vincular con
  // uno existente: a partir de aquí es una edición normal, mismo camino que
  // `updatePerson`, para no duplicar la lógica de guardado.
  const linkPersonId = String(formData.get("linkPersonId") ?? "").trim();
  if (linkPersonId && linkPersonId !== "new") {
    const linkedFormData = new FormData();
    for (const [key, value] of formData.entries()) linkedFormData.append(key, value);
    linkedFormData.set("id", linkPersonId);
    return updatePerson(_prev, linkedFormData);
  }

  const fields = readPersonFields(formData);
  const photo = readPhoto(formData);
  const guardianIds = readGuardianIds(formData);
  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (fields.iban && !isValidIban(fields.iban)) {
    return { error: t("ibanInvalid") };
  }
  if (photo && !ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { error: t("photoInvalidType") };
  }
  if (photo && photo.size > MAX_PHOTO_BYTES) {
    return { error: t("photoTooLarge") };
  }

  // Primer intento (sin `linkPersonId`): comprobar si ya existe alguien
  // parecido antes de crear una ficha duplicada — mismo mecanismo que la
  // revisión de inscripciones (`findCandidates` + `MatchSelect`). Si el
  // usuario ya eligió "crear de todas formas" (`linkPersonId === "new"`), no
  // se repite la comprobación.
  if (linkPersonId !== "new") {
    const pool = await db.query.persons.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        nationalId: true,
        email: true,
        birthDate: true,
        address: true,
        city: true,
        phone: true,
        iban: true,
        shirtSize: true,
        pantsSize: true,
        shoeSize: true,
      },
    });
    const candidates = findCandidates(
      {
        firstName: fields.firstName,
        lastName: fields.lastName,
        nationalId: fields.nationalId || null,
        email: fields.email || null,
      },
      pool,
    );
    if (candidates.length > 0) {
      const submittedFields: Record<string, string | null> = {};
      for (const key of PERSON_MATCH_FIELDS) submittedFields[key] = fields[key] || null;
      return { candidates, submittedFields };
    }
  }

  // Alta manual: sin consentimientos, se conceden al inscribirse, no aquí.
  const payer = resolvePayerFields(guardianIds, fields.iban || null, false);

  let personId: string;
  try {
    personId = await db.transaction(async (tx) => {
      const [person] = await tx
        .insert(persons)
        .values({
          firstName: fields.firstName,
          lastName: fields.lastName,
          email: fields.email || null,
          phone: fields.phone || null,
          birthDate: fields.birthDate || null,
          nationalId: fields.nationalId || null,
          address: fields.address || null,
          city: fields.city || null,
          iban: payer.iban,
          shirtSize: fields.shirtSize || null,
          pantsSize: fields.pantsSize || null,
          shoeSize: fields.shoeSize || null,
          photoConsent: false,
          photoConsentAt: null,
          sepaConsent: payer.sepaConsent,
          sepaConsentAt: stampConsent(payer.sepaConsent),
          payerPersonId: payer.payerPersonId,
          notes: fields.notes || null,
        })
        .returning({ id: persons.id });

      return person.id;
    });
    await syncClubMembership(personId, fields.isMember, fields.memberNumber);
  } catch (error) {
    const message = uniqueViolationMessage(error, t);
    if (message) return { error: message };
    throw error;
  }

  if (photo) {
    const path = await uploadPersonPhoto(personId, photo);
    await db.update(persons).set({ photoPath: path }).where(eq(persons.id, personId));
  }
  await replaceGuardians(personId, guardianIds);

  revalidatePath("/", "layout");
  return { message: t("personCreated") };
}

export async function updatePerson(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const fields = readPersonFields(formData);
  const photo = readPhoto(formData);
  const guardianIds = readGuardianIds(formData, id);
  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (fields.iban && !isValidIban(fields.iban)) {
    return { error: t("ibanInvalid") };
  }
  if (photo && !ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { error: t("photoInvalidType") };
  }
  if (photo && photo.size > MAX_PHOTO_BYTES) {
    return { error: t("photoTooLarge") };
  }

  const existing = await db.query.persons.findFirst({
    where: eq(persons.id, id),
    columns: {
      photoPath: true,
      photoConsent: true,
      photoConsentAt: true,
      sepaConsent: true,
      sepaConsentAt: true,
    },
  });

  // Los consentimientos no se editan desde esta ficha: se conservan tal cual
  // están (ver comentario en `readPersonFields`). Un tutor nuevo sí puede
  // anular el SEPA propio de la persona, igual que antes.
  const payer = resolvePayerFields(guardianIds, fields.iban || null, existing?.sepaConsent ?? false);

  try {
    await db
      .update(persons)
      .set({
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email || null,
        phone: fields.phone || null,
        birthDate: fields.birthDate || null,
        nationalId: fields.nationalId || null,
        address: fields.address || null,
        city: fields.city || null,
        iban: payer.iban,
        shirtSize: fields.shirtSize || null,
        pantsSize: fields.pantsSize || null,
        shoeSize: fields.shoeSize || null,
        photoConsent: existing?.photoConsent ?? false,
        photoConsentAt: existing?.photoConsentAt ?? null,
        sepaConsent: payer.sepaConsent,
        sepaConsentAt: nextConsentAt(
          existing?.sepaConsent ?? false,
          payer.sepaConsent,
          existing?.sepaConsentAt ?? null,
        ),
        payerPersonId: payer.payerPersonId,
        notes: fields.notes || null,
      })
      .where(eq(persons.id, id));
    await syncClubMembership(id, fields.isMember, fields.memberNumber);
  } catch (error) {
    const constraint = uniqueViolationConstraint(error);
    if (constraint === "club_members_member_number_idx") {
      return { error: t("memberNumberTaken") };
    }
    // Email/DNI duplicados al EDITAR apuntan a otra ficha ya existente: aquí
    // no se ofrece vincular (eso cambiaría de qué persona se está editando),
    // se remite a la herramienta ya existente de fusión de duplicados.
    if (constraint === "persons_national_id_idx") {
      return { error: `${t("nationalIdTaken")} ${t("mergeToolHint")}` };
    }
    if (constraint === "persons_email_idx") {
      return { error: `${t("emailTaken")} ${t("mergeToolHint")}` };
    }
    throw error;
  }

  if (photo) {
    if (existing?.photoPath) await removePersonPhotoObject(existing.photoPath);
    const path = await uploadPersonPhoto(id, photo);
    await db.update(persons).set({ photoPath: path }).where(eq(persons.id, id));
  } else if (fields.removePhoto && existing?.photoPath) {
    await removePersonPhotoObject(existing.photoPath);
    await db.update(persons).set({ photoPath: null }).where(eq(persons.id, id));
  }
  await replaceGuardians(id, guardianIds);

  revalidatePath("/", "layout");
  return { message: t("personUpdated") };
}

/** Cambia solo la foto, sin reenviar el resto de la ficha (botón junto al avatar). */
export async function updatePersonPhoto(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const photo = readPhoto(formData);
  const removePhoto = formData.get("removePhoto") === "on";
  if (photo && !ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { error: t("photoInvalidType") };
  }
  if (photo && photo.size > MAX_PHOTO_BYTES) {
    return { error: t("photoTooLarge") };
  }

  const existing = await db.query.persons.findFirst({
    where: eq(persons.id, id),
    columns: { photoPath: true },
  });

  if (photo) {
    if (existing?.photoPath) await removePersonPhotoObject(existing.photoPath);
    const path = await uploadPersonPhoto(id, photo);
    await db.update(persons).set({ photoPath: path }).where(eq(persons.id, id));
  } else if (removePhoto && existing?.photoPath) {
    await removePersonPhotoObject(existing.photoPath);
    await db.update(persons).set({ photoPath: null }).where(eq(persons.id, id));
  }

  revalidatePath("/", "layout");
  return { message: t("photoUpdated") };
}

const ID_SCAN_BUCKET = "person-documents";
const MAX_ID_SCAN_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ID_SCAN_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Sube o quita el escaneo del DNI/NIE (frontal o trasera) de una persona,
 * sin pasar por una inscripción. Misma ruta de Storage que la copia al
 * aprobar una inscripción (ver `inscripciones/actions.ts`), así que sustituye
 * limpiamente cualquier archivo que ya existiera por esa vía. */
export async function updatePersonIdScan(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const side = formData.get("side") === "back" ? "back" : "front";
  const fileField = formData.get("file");
  const file = fileField instanceof File && fileField.size > 0 ? fileField : null;
  const shouldRemove = formData.get("removeFile") === "on";
  if (file && !ALLOWED_ID_SCAN_TYPES.includes(file.type)) {
    return { error: t("documentFileInvalidType") };
  }
  if (file && file.size > MAX_ID_SCAN_BYTES) {
    return { error: t("documentFileTooLarge") };
  }

  const existing = await db.query.persons.findFirst({
    where: eq(persons.id, id),
    columns: { idFrontPath: true, idBackPath: true },
  });
  const existingPath = side === "front" ? existing?.idFrontPath : existing?.idBackPath;

  if (file) {
    if (existingPath) await removeFile(ID_SCAN_BUCKET, existingPath);
    const path = `${id}/id-${side}.${extensionFromMimeType(file.type)}`;
    await uploadFile(ID_SCAN_BUCKET, path, file);
    if (side === "front") {
      await db.update(persons).set({ idFrontPath: path }).where(eq(persons.id, id));
    } else {
      await db.update(persons).set({ idBackPath: path }).where(eq(persons.id, id));
    }
  } else if (shouldRemove && existingPath) {
    await removeFile(ID_SCAN_BUCKET, existingPath);
    if (side === "front") {
      await db.update(persons).set({ idFrontPath: null }).where(eq(persons.id, id));
    } else {
      await db.update(persons).set({ idBackPath: null }).where(eq(persons.id, id));
    }
  }

  revalidatePath("/", "layout");
  return { message: t("idScanUpdated") };
}

export async function deletePerson(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.persons.findFirst({
    where: eq(persons.id, id),
    columns: { photoPath: true },
  });

  await db.delete(persons).where(eq(persons.id, id));
  if (existing?.photoPath) await removePersonPhotoObject(existing.photoPath);

  revalidatePath("/", "layout");
  return { message: t("personDeleted") };
}

function readQualificationFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    issuer: String(formData.get("issuer") ?? "").trim(),
    issuedOn: String(formData.get("issuedOn") ?? "").trim(),
    expiresOn: String(formData.get("expiresOn") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    removeFile: formData.get("removeFile") === "on",
  };
}

function readQualificationFile(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

export async function addQualification(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const personId = String(formData.get("personId") ?? "");
  const fields = readQualificationFields(formData);
  const file = readQualificationFile(formData);
  if (!fields.title) return { error: t("qualificationTitleRequired") };
  if (file && !ALLOWED_QUALIFICATION_FILE_TYPES.includes(file.type)) {
    return { error: t("qualificationFileInvalidType") };
  }
  if (file && file.size > MAX_QUALIFICATION_FILE_BYTES) {
    return { error: t("qualificationFileTooLarge") };
  }

  const [qualification] = await db
    .insert(personQualifications)
    .values({
      personId,
      title: fields.title,
      issuer: fields.issuer || null,
      issuedOn: fields.issuedOn || null,
      expiresOn: fields.expiresOn || null,
      notes: fields.notes || null,
    })
    .returning({ id: personQualifications.id });

  if (file) {
    const path = await uploadQualificationFile(personId, qualification.id, file);
    await db
      .update(personQualifications)
      .set({ filePath: path })
      .where(eq(personQualifications.id, qualification.id));
  }

  revalidatePath("/", "layout");
  return { message: t("qualificationAdded") };
}

export async function updateQualification(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const fields = readQualificationFields(formData);
  const file = readQualificationFile(formData);
  if (!fields.title) return { error: t("qualificationTitleRequired") };
  if (file && !ALLOWED_QUALIFICATION_FILE_TYPES.includes(file.type)) {
    return { error: t("qualificationFileInvalidType") };
  }
  if (file && file.size > MAX_QUALIFICATION_FILE_BYTES) {
    return { error: t("qualificationFileTooLarge") };
  }

  const existing = await db.query.personQualifications.findFirst({
    where: eq(personQualifications.id, id),
    columns: { personId: true, filePath: true },
  });
  if (!existing) return { error: t("qualificationNotFound") };

  await db
    .update(personQualifications)
    .set({
      title: fields.title,
      issuer: fields.issuer || null,
      issuedOn: fields.issuedOn || null,
      expiresOn: fields.expiresOn || null,
      notes: fields.notes || null,
    })
    .where(eq(personQualifications.id, id));

  if (file) {
    if (existing.filePath) await removeQualificationFileObject(existing.filePath);
    const path = await uploadQualificationFile(existing.personId, id, file);
    await db
      .update(personQualifications)
      .set({ filePath: path })
      .where(eq(personQualifications.id, id));
  } else if (fields.removeFile && existing.filePath) {
    await removeQualificationFileObject(existing.filePath);
    await db
      .update(personQualifications)
      .set({ filePath: null })
      .where(eq(personQualifications.id, id));
  }

  revalidatePath("/", "layout");
  return { message: t("qualificationUpdated") };
}

export async function deleteQualification(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.personQualifications.findFirst({
    where: eq(personQualifications.id, id),
    columns: { filePath: true },
  });

  await db.delete(personQualifications).where(eq(personQualifications.id, id));
  if (existing?.filePath) await removeQualificationFileObject(existing.filePath);

  revalidatePath("/", "layout");
  return { message: t("qualificationDeleted") };
}

function readMedicalCheckupFields(formData: FormData) {
  return {
    occurredOn: String(formData.get("occurredOn") ?? "").trim(),
    expiresOn: String(formData.get("expiresOn") ?? "").trim(),
    issuer: String(formData.get("issuer") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    removeFile: formData.get("removeFile") === "on",
  };
}

function readMedicalFile(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

export async function addMedicalCheckup(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const personId = String(formData.get("personId") ?? "");
  const fields = readMedicalCheckupFields(formData);
  const file = readMedicalFile(formData);
  if (!fields.occurredOn) return { error: t("medicalCheckupOccurredOnRequired") };
  if (file && !ALLOWED_MEDICAL_FILE_TYPES.includes(file.type)) {
    return { error: t("medicalCheckupFileInvalidType") };
  }
  if (file && file.size > MAX_MEDICAL_FILE_BYTES) {
    return { error: t("medicalCheckupFileTooLarge") };
  }

  const [checkup] = await db
    .insert(personMedicalCheckups)
    .values({
      personId,
      occurredOn: fields.occurredOn,
      expiresOn: fields.expiresOn || null,
      issuer: fields.issuer || null,
      notes: fields.notes || null,
    })
    .returning({ id: personMedicalCheckups.id });

  if (file) {
    const path = await uploadMedicalCheckupFile(personId, checkup.id, file);
    await db
      .update(personMedicalCheckups)
      .set({ filePath: path })
      .where(eq(personMedicalCheckups.id, checkup.id));
  }

  await recomputeMedicalCertUntil(personId);
  revalidatePath("/", "layout");
  return { message: t("medicalCheckupAdded") };
}

export async function updateMedicalCheckup(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const fields = readMedicalCheckupFields(formData);
  const file = readMedicalFile(formData);
  if (!fields.occurredOn) return { error: t("medicalCheckupOccurredOnRequired") };
  if (file && !ALLOWED_MEDICAL_FILE_TYPES.includes(file.type)) {
    return { error: t("medicalCheckupFileInvalidType") };
  }
  if (file && file.size > MAX_MEDICAL_FILE_BYTES) {
    return { error: t("medicalCheckupFileTooLarge") };
  }

  const existing = await db.query.personMedicalCheckups.findFirst({
    where: eq(personMedicalCheckups.id, id),
    columns: { personId: true, filePath: true },
  });
  if (!existing) return { error: t("medicalCheckupNotFound") };

  await db
    .update(personMedicalCheckups)
    .set({
      occurredOn: fields.occurredOn,
      expiresOn: fields.expiresOn || null,
      issuer: fields.issuer || null,
      notes: fields.notes || null,
    })
    .where(eq(personMedicalCheckups.id, id));

  if (file) {
    if (existing.filePath) await removeMedicalCheckupFileObject(existing.filePath);
    const path = await uploadMedicalCheckupFile(existing.personId, id, file);
    await db
      .update(personMedicalCheckups)
      .set({ filePath: path })
      .where(eq(personMedicalCheckups.id, id));
  } else if (fields.removeFile && existing.filePath) {
    await removeMedicalCheckupFileObject(existing.filePath);
    await db
      .update(personMedicalCheckups)
      .set({ filePath: null })
      .where(eq(personMedicalCheckups.id, id));
  }

  await recomputeMedicalCertUntil(existing.personId);
  revalidatePath("/", "layout");
  return { message: t("medicalCheckupUpdated") };
}

export async function deleteMedicalCheckup(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.personMedicalCheckups.findFirst({
    where: eq(personMedicalCheckups.id, id),
    columns: { personId: true, filePath: true },
  });

  await db.delete(personMedicalCheckups).where(eq(personMedicalCheckups.id, id));
  if (existing?.filePath) await removeMedicalCheckupFileObject(existing.filePath);
  if (existing) await recomputeMedicalCertUntil(existing.personId);

  revalidatePath("/", "layout");
  return { message: t("medicalCheckupDeleted") };
}

function readInjuryReportFields(formData: FormData) {
  return {
    occurredOn: String(formData.get("occurredOn") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    removeFile: formData.get("removeFile") === "on",
  };
}

export async function addInjuryReport(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const personId = String(formData.get("personId") ?? "");
  const fields = readInjuryReportFields(formData);
  const file = readMedicalFile(formData);
  if (!fields.occurredOn) return { error: t("injuryReportOccurredOnRequired") };
  if (!fields.description) return { error: t("injuryReportDescriptionRequired") };
  if (file && !ALLOWED_MEDICAL_FILE_TYPES.includes(file.type)) {
    return { error: t("injuryReportFileInvalidType") };
  }
  if (file && file.size > MAX_MEDICAL_FILE_BYTES) {
    return { error: t("injuryReportFileTooLarge") };
  }

  const [report] = await db
    .insert(personInjuryReports)
    .values({
      personId,
      occurredOn: fields.occurredOn,
      description: fields.description,
      notes: fields.notes || null,
    })
    .returning({ id: personInjuryReports.id });

  if (file) {
    const path = await uploadInjuryReportFile(personId, report.id, file);
    await db
      .update(personInjuryReports)
      .set({ filePath: path })
      .where(eq(personInjuryReports.id, report.id));
  }

  revalidatePath("/", "layout");
  return { message: t("injuryReportAdded") };
}

export async function updateInjuryReport(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const fields = readInjuryReportFields(formData);
  const file = readMedicalFile(formData);
  if (!fields.occurredOn) return { error: t("injuryReportOccurredOnRequired") };
  if (!fields.description) return { error: t("injuryReportDescriptionRequired") };
  if (file && !ALLOWED_MEDICAL_FILE_TYPES.includes(file.type)) {
    return { error: t("injuryReportFileInvalidType") };
  }
  if (file && file.size > MAX_MEDICAL_FILE_BYTES) {
    return { error: t("injuryReportFileTooLarge") };
  }

  const existing = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, id),
    columns: { personId: true, filePath: true },
  });
  if (!existing) return { error: t("injuryReportNotFound") };

  await db
    .update(personInjuryReports)
    .set({
      occurredOn: fields.occurredOn,
      description: fields.description,
      notes: fields.notes || null,
    })
    .where(eq(personInjuryReports.id, id));

  if (file) {
    if (existing.filePath) await removeInjuryReportFileObject(existing.filePath);
    const path = await uploadInjuryReportFile(existing.personId, id, file);
    await db
      .update(personInjuryReports)
      .set({ filePath: path })
      .where(eq(personInjuryReports.id, id));
  } else if (fields.removeFile && existing.filePath) {
    await removeInjuryReportFileObject(existing.filePath);
    await db
      .update(personInjuryReports)
      .set({ filePath: null })
      .where(eq(personInjuryReports.id, id));
  }

  revalidatePath("/", "layout");
  return { message: t("injuryReportUpdated") };
}

export async function deleteInjuryReport(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, id),
    columns: { filePath: true },
  });

  await db.delete(personInjuryReports).where(eq(personInjuryReports.id, id));
  if (existing?.filePath) await removeInjuryReportFileObject(existing.filePath);

  revalidatePath("/", "layout");
  return { message: t("injuryReportDeleted") };
}

const personDocumentActions = makeDocumentActions({
  table: personDocuments,
  bucket: "person-documents",
  parentIdColumn: "personId",
  formKey: "personId",
  namespace: "Personas",
});
export const addPersonDocument = personDocumentActions.add;
export const updatePersonDocument = personDocumentActions.update;
export const deletePersonDocument = personDocumentActions.delete;

/**
 * Asigna el siguiente nº de socio correlativo (max+1) a una persona que no lo
 * tenga. Reintenta ante colisión por si otra alta lo ocupó en paralelo (el
 * índice único protege la unicidad).
 */
export async function assignNextMemberNumber(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.clubMembers.findFirst({
    where: eq(clubMembers.personId, id),
    columns: { id: true, memberNumber: true },
  });
  if (!existing) return { error: t("memberNumberAssignFailed") };
  if (existing.memberNumber !== null) {
    return { message: t("memberNumberAssigned", { number: existing.memberNumber }) };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(${clubMembers.memberNumber}), 0)` })
      .from(clubMembers);
    const next = (row?.max ?? 0) + 1 + attempt;
    try {
      await db.update(clubMembers).set({ memberNumber: next }).where(eq(clubMembers.id, existing.id));
      revalidatePath("/", "layout");
      return { message: t("memberNumberAssigned", { number: next }) };
    } catch (error) {
      if (uniqueViolationConstraint(error) === "club_members_member_number_idx") continue;
      throw error;
    }
  }
  return { error: t("memberNumberAssignFailed") };
}

export async function bulkSetMember(personIds: string[], isMember: boolean): Promise<void> {
  await requireRole([...MANAGE_ROLES]);
  if (personIds.length === 0) return;

  const existingRows = await db.query.clubMembers.findMany({
    where: inArray(clubMembers.personId, personIds),
  });
  const existingByPerson = new Map(existingRows.map((r) => [r.personId, r]));

  if (isMember) {
    const toInsert = personIds.filter((id) => !existingByPerson.has(id));
    const toReactivate = existingRows.filter((r) => r.status !== "active").map((r) => r.id);
    if (toInsert.length > 0) {
      await db
        .insert(clubMembers)
        .values(toInsert.map((personId) => ({ personId, status: "active" as const, joinedAt: today() })));
    }
    if (toReactivate.length > 0) {
      await db
        .update(clubMembers)
        .set({ status: "active", cancelledAt: null })
        .where(inArray(clubMembers.id, toReactivate));
    }
  } else {
    const toCancel = existingRows.filter((r) => r.status === "active").map((r) => r.id);
    if (toCancel.length > 0) {
      await db
        .update(clubMembers)
        .set({ status: "cancelled", cancelledAt: today() })
        .where(inArray(clubMembers.id, toCancel));
    }
  }

  revalidatePath("/", "layout");
}

const BULK_MEMBERSHIP_ROLES = ["player", "coach", "staff"] as const;
type BulkMembershipRole = (typeof BULK_MEMBERSHIP_ROLES)[number];

export async function bulkAddToTeam(
  personIds: string[],
  teamId: string,
  role: BulkMembershipRole,
): Promise<void> {
  await requireRole([...MANAGE_ROLES]);
  if (personIds.length === 0 || !teamId) return;
  const safeRole = (BULK_MEMBERSHIP_ROLES as readonly string[]).includes(role)
    ? role
    : "player";

  await db
    .insert(memberships)
    .values(personIds.map((personId) => ({ personId, teamId, role: safeRole })))
    .onConflictDoNothing();

  revalidatePath("/", "layout");
}

const personNoteActions = makeNoteActions({
  table: personNotes,
  parentIdColumn: "personId",
  formKey: "personId",
  namespace: "Personas",
});
export const addPersonNote = personNoteActions.add;
export const deletePersonNote = personNoteActions.delete;

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function addPersonTag(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const personId = String(formData.get("personId") ?? "");
  const tag = normalizeTag(String(formData.get("tag") ?? ""));
  if (!tag) return { error: t("tagRequired") };

  await db.insert(personTags).values({ personId, tag }).onConflictDoNothing();

  revalidatePath("/", "layout");
  return { message: t("tagAdded") };
}

export async function deletePersonTag(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  await db.delete(personTags).where(eq(personTags.id, id));

  revalidatePath("/", "layout");
  return { message: t("tagDeleted") };
}
