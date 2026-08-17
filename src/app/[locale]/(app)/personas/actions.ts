"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  memberships,
  personDocuments,
  personNotes,
  personQualifications,
  personTags,
  persons,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { makeDocumentActions } from "@/lib/entity-documents";
import { makeNoteActions } from "@/lib/entity-notes";
import { isValidNationalId } from "@/lib/national-id";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";

export type PersonState = {
  error?: string;
  message?: string;
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

function readGuardianId(formData: FormData): string {
  const raw = String(formData.get("guardianId") ?? "").trim();
  return raw === "none" ? "" : raw;
}

function readMemberNumber(formData: FormData): number | null {
  const raw = String(formData.get("memberNumber") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Distingue qué restricción única falló (email vs nº de socio) en un error 23505. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === constraint
  );
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
    guardianId: readGuardianId(formData),
    medicalCertUntil: String(formData.get("medicalCertUntil") ?? "").trim(),
    shirtSize: String(formData.get("shirtSize") ?? "").trim(),
    pantsSize: String(formData.get("pantsSize") ?? "").trim(),
    shoeSize: String(formData.get("shoeSize") ?? "").trim(),
    photoConsent: formData.get("photoConsent") === "on",
    removePhoto: formData.get("removePhoto") === "on",
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function readPhoto(formData: FormData): File | null {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

export async function createPerson(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

  const fields = readPersonFields(formData);
  const photo = readPhoto(formData);
  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (photo && !ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return { error: t("photoInvalidType") };
  }
  if (photo && photo.size > MAX_PHOTO_BYTES) {
    return { error: t("photoTooLarge") };
  }

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
          isMember: fields.isMember,
          memberNumber: fields.memberNumber,
          address: fields.address || null,
          city: fields.city || null,
          iban: fields.iban || null,
          guardianId: fields.guardianId || null,
          medicalCertUntil: fields.medicalCertUntil || null,
          shirtSize: fields.shirtSize || null,
          pantsSize: fields.pantsSize || null,
          shoeSize: fields.shoeSize || null,
          photoConsent: fields.photoConsent,
          notes: fields.notes || null,
        })
        .returning({ id: persons.id });

      return person.id;
    });
  } catch (error) {
    if (isUniqueViolation(error, "persons_member_number_idx")) {
      return { error: t("memberNumberTaken") };
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("emailTaken") };
    }
    throw error;
  }

  if (photo) {
    const path = await uploadPersonPhoto(personId, photo);
    await db.update(persons).set({ photoPath: path }).where(eq(persons.id, personId));
  }

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
  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (fields.guardianId && fields.guardianId === id) {
    return { error: t("guardianSelfError") };
  }
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
        isMember: fields.isMember,
        memberNumber: fields.memberNumber,
        address: fields.address || null,
        city: fields.city || null,
        iban: fields.iban || null,
        guardianId: fields.guardianId || null,
        medicalCertUntil: fields.medicalCertUntil || null,
        shirtSize: fields.shirtSize || null,
        pantsSize: fields.pantsSize || null,
        shoeSize: fields.shoeSize || null,
        photoConsent: fields.photoConsent,
        notes: fields.notes || null,
      })
      .where(eq(persons.id, id));
  } catch (error) {
    if (isUniqueViolation(error, "persons_member_number_idx")) {
      return { error: t("memberNumberTaken") };
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: t("emailTaken") };
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

  revalidatePath("/", "layout");
  return { message: t("personUpdated") };
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
  const existing = await db.query.persons.findFirst({
    where: eq(persons.id, id),
    columns: { memberNumber: true },
  });
  if (!existing) return { error: t("memberNumberAssignFailed") };
  if (existing.memberNumber !== null) {
    return { message: t("memberNumberAssigned", { number: existing.memberNumber }) };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(${persons.memberNumber}), 0)` })
      .from(persons);
    const next = (row?.max ?? 0) + 1 + attempt;
    try {
      await db.update(persons).set({ memberNumber: next }).where(eq(persons.id, id));
      revalidatePath("/", "layout");
      return { message: t("memberNumberAssigned", { number: next }) };
    } catch (error) {
      if (isUniqueViolation(error, "persons_member_number_idx")) continue;
      throw error;
    }
  }
  return { error: t("memberNumberAssignFailed") };
}

export async function bulkSetMember(personIds: string[], isMember: boolean): Promise<void> {
  await requireRole([...MANAGE_ROLES]);
  if (personIds.length === 0) return;

  await db.update(persons).set({ isMember }).where(inArray(persons.id, personIds));

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
