"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  memberships,
  personDocuments,
  personGuardians,
  persons,
  registrationGuardians,
  registrations,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { isValidNationalId } from "@/lib/national-id";
import { readGuardians } from "@/lib/registration-guardians";
import { copyFileBetweenBuckets } from "@/lib/supabase/storage";

export type RegistrationReviewState = {
  error?: string;
  message?: string;
};

const MANAGE_ROLES = ["admin", "staff"] as const;
const REGISTRATION_BUCKET = "registration-documents";
const PERSON_PHOTO_BUCKET = "person-photos";
const PERSON_DOCUMENTS_BUCKET = "person-documents";

function extFromPath(path: string): string {
  return path.split(".").pop() ?? "jpg";
}

/** Detecta una violación de restricción única de Postgres (código 23505),
 * opcionalmente acotada a una restricción concreta. */
function isUniqueViolation(err: unknown, constraintName?: string): boolean {
  const cause = err instanceof Error ? err.cause : undefined;
  if (!cause || typeof cause !== "object" || (cause as { code?: string }).code !== "23505") {
    return false;
  }
  if (!constraintName) return true;
  return (cause as { constraint_name?: string }).constraint_name === constraintName;
}

function readEditableFields(formData: FormData) {
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
    shirtSize: String(formData.get("shirtSize") ?? "").trim(),
    pantsSize: String(formData.get("pantsSize") ?? "").trim(),
    shoeSize: String(formData.get("shoeSize") ?? "").trim(),
    installmentsChosen: Number(formData.get("installmentsChosen") ?? "1") === 2 ? 2 : 1,
    // sepaConsent, termsConsent e imageConsent NO son editables aquí a propósito:
    // deben reflejar siempre fielmente lo que la persona autorizó al enviar el formulario.
  };
}

export async function updateRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const fields = readEditableFields(formData);
  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }

  await db
    .update(registrations)
    .set({
      firstName: fields.firstName,
      lastName: fields.lastName,
      birthDate: fields.birthDate || null,
      nationalId: fields.nationalId || null,
      address: fields.address || null,
      city: fields.city || null,
      phone: fields.phone || null,
      email: fields.email || null,
      iban: fields.iban || null,
      shirtSize: fields.shirtSize || null,
      pantsSize: fields.pantsSize || null,
      shoeSize: fields.shoeSize || null,
      installmentsChosen: fields.installmentsChosen,
    })
    .where(eq(registrations.id, id));

  const guardians = readGuardians(formData);
  await db.delete(registrationGuardians).where(eq(registrationGuardians.registrationId, id));
  if (guardians.length > 0) {
    await db.insert(registrationGuardians).values(
      guardians.map((g, i) => ({
        registrationId: id,
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

  revalidatePath("/", "layout");
  return { message: t("registrationUpdated") };
}

export async function approveRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");
  const reviewer = await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const matchedPersonId = String(formData.get("matchedPersonId") ?? "new");

  const registration = await db.query.registrations.findFirst({
    where: eq(registrations.id, id),
    with: { guardians: { orderBy: (g, { asc }) => [asc(g.sortOrder)] } },
  });
  if (!registration) return { error: t("notFound") };
  if (registration.status !== "pending") return { error: t("alreadyReviewed") };

  let personId: string;
  try {
    personId = await db.transaction(async (tx) => {
      let personId: string;
      if (matchedPersonId !== "new") {
        personId = matchedPersonId;
        await tx
          .update(persons)
          .set({
            firstName: registration.firstName,
            lastName: registration.lastName,
            birthDate: registration.birthDate,
            nationalId: registration.nationalId,
            address: registration.address,
            city: registration.city,
            phone: registration.phone,
            email: registration.email,
            iban: registration.iban,
            shirtSize: registration.shirtSize,
            pantsSize: registration.pantsSize,
            shoeSize: registration.shoeSize,
            photoConsent: registration.imageConsent,
            sepaConsent: registration.sepaConsent,
          })
          .where(eq(persons.id, personId));
      } else {
        const [inserted] = await tx
          .insert(persons)
          .values({
            firstName: registration.firstName,
            lastName: registration.lastName,
            birthDate: registration.birthDate,
            nationalId: registration.nationalId,
            address: registration.address,
            city: registration.city,
            phone: registration.phone,
            email: registration.email,
            iban: registration.iban,
            shirtSize: registration.shirtSize,
            pantsSize: registration.pantsSize,
            shoeSize: registration.shoeSize,
            photoConsent: registration.imageConsent,
            sepaConsent: registration.sepaConsent,
          })
          .returning({ id: persons.id });
        personId = inserted.id;
      }

      const guardianPersonIds: string[] = [];
      for (const g of registration.guardians) {
        const matchValue = String(formData.get(`matchedFor_${g.id}`) ?? "new");
        let guardianPersonId: string;
        if (matchValue !== "new") {
          guardianPersonId = matchValue;
          await tx
            .update(persons)
            .set({
              firstName: g.firstName,
              lastName: g.lastName,
              birthDate: g.birthDate,
              nationalId: g.nationalId,
              address: g.address,
              phone: g.phone,
              email: g.email,
            })
            .where(eq(persons.id, guardianPersonId));
        } else {
          const [insertedGuardian] = await tx
            .insert(persons)
            .values({
              firstName: g.firstName,
              lastName: g.lastName,
              birthDate: g.birthDate,
              nationalId: g.nationalId,
              address: g.address,
              phone: g.phone,
              email: g.email,
            })
            .returning({ id: persons.id });
          guardianPersonId = insertedGuardian.id;
        }
        guardianPersonIds.push(guardianPersonId);
      }

      if (guardianPersonIds.length > 0) {
        await tx.delete(personGuardians).where(eq(personGuardians.personId, personId));
        await tx.insert(personGuardians).values(
          guardianPersonIds.map((guardianId, i) => ({
            personId,
            guardianId,
            isPrimary: i === 0,
          })),
        );
      }

      if (teamId) {
        await tx
          .insert(memberships)
          .values({ personId, teamId, role: registration.kind === "coach" ? "coach" : "player" })
          .onConflictDoNothing();
      }

      await tx
        .update(registrations)
        .set({
          status: "approved",
          reviewedBy: reviewer.id,
          reviewedAt: new Date(),
          matchedPersonId: personId,
        })
        .where(eq(registrations.id, id));

      return personId;
    });
  } catch (err) {
    if (
      isUniqueViolation(err, "persons_email_idx") ||
      isUniqueViolation(err, "persons_national_id_idx")
    ) {
      return { error: t("duplicatePersonFound") };
    }
    throw err;
  }

  if (registration.photoPath) {
    const targetPath = `${personId}/photo.${extFromPath(registration.photoPath)}`;
    await copyFileBetweenBuckets(
      REGISTRATION_BUCKET,
      registration.photoPath,
      PERSON_PHOTO_BUCKET,
      targetPath,
    );
    await db.update(persons).set({ photoPath: targetPath }).where(eq(persons.id, personId));
  }

  const idDocs: { path: string | null; label: string }[] = [
    { path: registration.idFrontPath, label: t("idFrontDocLabel") },
    { path: registration.idBackPath, label: t("idBackDocLabel") },
  ];
  for (const doc of idDocs) {
    if (!doc.path) continue;
    const docId = randomUUID();
    const targetPath = `${personId}/${docId}.${extFromPath(doc.path)}`;
    await copyFileBetweenBuckets(REGISTRATION_BUCKET, doc.path, PERSON_DOCUMENTS_BUCKET, targetPath);
    await db.insert(personDocuments).values({ id: docId, personId, label: doc.label, filePath: targetPath });
  }

  revalidatePath("/", "layout");
  return { message: t("registrationApproved") };
}

export async function rejectRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");
  const reviewer = await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();
  if (!rejectionReason) return { error: t("rejectionReasonRequired") };

  const registration = await db.query.registrations.findFirst({ where: eq(registrations.id, id) });
  if (!registration) return { error: t("notFound") };
  if (registration.status !== "pending") return { error: t("alreadyReviewed") };

  await db
    .update(registrations)
    .set({ status: "rejected", reviewedBy: reviewer.id, reviewedAt: new Date(), rejectionReason })
    .where(eq(registrations.id, id));

  revalidatePath("/", "layout");
  return { message: t("registrationRejected") };
}
