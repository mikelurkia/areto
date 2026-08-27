"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import {
  clubMembers,
  memberships,
  personGuardians,
  persons,
  registrationGuardians,
  registrations,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { INTEGRITY_ISSUES_TAG } from "@/lib/data-integrity";
import { isValidIban } from "@/lib/iban";
import { resizeImageToWebp } from "@/lib/image-resize";
import { isValidNationalId } from "@/lib/national-id";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { resolvePayerFields } from "@/lib/payer";
import { readGuardians } from "@/lib/registration-guardians";
import { SEASON_RENEWALS_TAG } from "@/lib/season-renewals";
import { copyFileBetweenBuckets, downloadFile, removeFile, uploadFile } from "@/lib/supabase/storage";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type RegistrationReviewState = {
  error?: string;
  message?: string;
};

const MEMBERSHIP_ROLES = ["player", "coach", "staff"] as const;
type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
const REGISTRATION_BUCKET = "registration-documents";
const PERSON_PHOTO_BUCKET = "person-photos";
const PERSON_DOCUMENTS_BUCKET = "person-documents";

function extFromPath(path: string): string {
  return path.split(".").pop() ?? "jpg";
}

const PHOTO_THUMB_MAX_DIMENSION = 256;

/**
 * Genera la miniatura de la foto ya copiada a `person-photos`, a partir de
 * ese mismo original recién copiado — no de la miniatura de la inscripción
 * (que puede no existir para solicitudes enviadas antes de que empezara a
 * generarse), así que no depende de que exista.
 */
async function regeneratePersonPhotoThumb(personPhotoPath: string): Promise<void> {
  const original = await downloadFile(PERSON_PHOTO_BUCKET, personPhotoPath);
  const thumb = await resizeImageToWebp(
    new File([original], "photo", { type: original.type }),
    PHOTO_THUMB_MAX_DIMENSION,
  );
  await uploadFile(PERSON_PHOTO_BUCKET, personPhotoThumbPath(personPhotoPath), thumb);
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

const PERSON_UPDATE_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "postalCode",
  "phone",
  "email",
  "iban",
  "shirtSize",
  "pantsSize",
  "shoeSize",
] as const;

/** Cuando hay tutor pagador, el iban ya no es un campo propio del jugador. */
const PERSON_UPDATE_FIELDS_WITHOUT_IBAN = PERSON_UPDATE_FIELDS.filter(
  (field) => field !== "iban",
);

/** Un socio no tiene tallas: si se incluyeran aquí, aprobar su alta borraría
 * las tallas ya guardadas de una persona que también fuera jugador. */
const MEMBER_UPDATE_FIELDS = PERSON_UPDATE_FIELDS.filter(
  (field) => field !== "shirtSize" && field !== "pantsSize" && field !== "shoeSize",
);
const MEMBER_UPDATE_FIELDS_WITHOUT_IBAN = MEMBER_UPDATE_FIELDS.filter(
  (field) => field !== "iban",
);

const GUARDIAN_UPDATE_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "postalCode",
  "phone",
  "email",
] as const;

/** El tutor principal (el primero introducido) es quien domicilia la cuota:
 * su iban sí es un campo editable/comparable, a diferencia del resto. */
const GUARDIAN_PAYER_UPDATE_FIELDS = [...GUARDIAN_UPDATE_FIELDS, "iban"] as const;

/** Si el revisor ha marcado "mantener el valor actual" al vincular con una
 * persona existente (ver el diff en `review-form.tsx`), se respeta ese valor
 * en vez del que trae la inscripción. */
function applyKeepOverrides<T extends Record<string, unknown>>(
  fresh: T,
  existing: T | null,
  formData: FormData,
  keepPrefix: string,
  fields: readonly (keyof T)[],
): T {
  if (!existing) return fresh;
  const result = { ...fresh };
  for (const field of fields) {
    if (formData.get(`keep_${keepPrefix}_${String(field)}`) === "on") {
      result[field] = existing[field];
    }
  }
  return result;
}

function readEditableFields(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "").trim(),
    nationalId: String(formData.get("nationalId") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    iban: String(formData.get("iban") ?? "").trim(),
    shirtSize: String(formData.get("shirtSize") ?? "").trim(),
    pantsSize: String(formData.get("pantsSize") ?? "").trim(),
    shoeSize: String(formData.get("shoeSize") ?? "").trim(),
    installmentsChosen: Number(formData.get("installmentsChosen") ?? "1") === 2 ? 2 : 1,
    // sepaConsent, termsConsent, photoConsent y privacyConsent NO son editables aquí
    // a propósito: deben reflejar siempre fielmente lo que la persona autorizó al
    // enviar el formulario.
  };
}

export async function updateRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.registrations.findFirst({ where: eq(registrations.id, id) });
  if (!existing) return { error: t("notFound") };
  await requirePermission(
    existing.kind === "member" ? ["inscripciones.manage", "socios.manage"] : "inscripciones.manage",
  );
  if (existing.status !== "pending") return { error: t("alreadyReviewed") };

  const kind = String(formData.get("kind") ?? "player");
  const isPlayerKind = kind === "player";
  const fields = readEditableFields(formData);
  if (!fields.firstName) return { error: t("firstNameRequired") };
  if (!fields.lastName) return { error: t("lastNameRequired") };
  if (fields.nationalId && !isValidNationalId(fields.nationalId)) {
    return { error: t("nationalIdInvalid") };
  }
  if (fields.iban && !isValidIban(fields.iban)) {
    return { error: t("ibanInvalid") };
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
      postalCode: fields.postalCode || null,
      phone: fields.phone || null,
      email: fields.email || null,
      iban: fields.iban || null,
      // Un socio no tiene tallas ni plazos: no se tocan esas columnas de la
      // propia solicitud, igual que no se piden en su formulario.
      ...(isPlayerKind
        ? {
            shirtSize: fields.shirtSize || null,
            pantsSize: fields.pantsSize || null,
            shoeSize: fields.shoeSize || null,
            installmentsChosen: fields.installmentsChosen,
          }
        : {}),
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

  revalidateRoutes(
    ROUTE.inscripciones,
    ROUTE.inscripcionFicha,
    ROUTE.socios,
    ROUTE.socioFicha,
    ROUTE.dashboard,
  );
  return { message: t("registrationUpdated") };
}

export async function approveRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");

  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const matchedPersonId = String(formData.get("matchedPersonId") ?? "new");
  const membershipRoleRaw = String(formData.get("membershipRole") ?? "player");
  const membershipRole: MembershipRole = MEMBERSHIP_ROLES.includes(membershipRoleRaw as MembershipRole)
    ? (membershipRoleRaw as MembershipRole)
    : "player";

  const registration = await db.query.registrations.findFirst({
    where: eq(registrations.id, id),
    with: { guardians: { orderBy: (g, { asc }) => [asc(g.sortOrder)] } },
  });
  if (!registration) return { error: t("notFound") };
  const reviewer = await requirePermission(
    registration.kind === "member" ? ["inscripciones.manage", "socios.manage"] : "inscripciones.manage",
  );
  if (registration.status !== "pending") return { error: t("alreadyReviewed") };
  if (registration.iban && !isValidIban(registration.iban)) {
    return { error: t("ibanInvalidFixFirst") };
  }

  let personId: string;
  try {
    personId = await db.transaction(async (tx) => {
      let personId: string;

      // Los tutores se procesan primero: el tutor principal (el primero
      // introducido) es quien domicilia la cuota de un jugador menor, así
      // que hace falta conocer su id antes de dar de alta/actualizar al
      // jugador con el `payerPersonId` correcto.
      const guardianPersonIds: string[] = [];
      for (const [i, g] of registration.guardians.entries()) {
        const isPayer = i === 0;
        const matchValue = String(formData.get(`matchedFor_${g.id}`) ?? "new");
        let guardianPersonId: string;
        if (matchValue !== "new") {
          guardianPersonId = matchValue;
          const existingGuardian = await tx.query.persons.findFirst({
            where: eq(persons.id, guardianPersonId),
            columns: {
              firstName: true,
              lastName: true,
              birthDate: true,
              nationalId: true,
              address: true,
              city: true,
              postalCode: true,
              phone: true,
              email: true,
              iban: true,
            },
          });
          const guardianFields = applyKeepOverrides(
            {
              firstName: g.firstName,
              lastName: g.lastName,
              birthDate: g.birthDate,
              nationalId: g.nationalId,
              address: g.address,
              city: g.city,
              postalCode: g.postalCode,
              phone: g.phone,
              email: g.email,
              ...(isPayer ? { iban: registration.iban } : {}),
            },
            existingGuardian ?? null,
            formData,
            `guardian_${g.id}`,
            isPayer ? GUARDIAN_PAYER_UPDATE_FIELDS : GUARDIAN_UPDATE_FIELDS,
          );
          await tx
            .update(persons)
            .set({
              ...guardianFields,
              ...(isPayer
                ? {
                    sepaConsent: registration.sepaConsent,
                    sepaConsentAt: registration.sepaConsentAt,
                  }
                : {}),
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
              city: g.city,
              postalCode: g.postalCode,
              phone: g.phone,
              email: g.email,
              ...(isPayer
                ? {
                    iban: registration.iban,
                    sepaConsent: registration.sepaConsent,
                    sepaConsentAt: registration.sepaConsentAt,
                  }
                : {}),
            })
            .returning({ id: persons.id });
          guardianPersonId = insertedGuardian.id;
        }
        guardianPersonIds.push(guardianPersonId);
        await tx
          .update(registrationGuardians)
          .set({ matchedPersonId: guardianPersonId })
          .where(eq(registrationGuardians.id, g.id));
      }

      const payer = resolvePayerFields(guardianPersonIds, registration.iban, registration.sepaConsent);
      const payerPersonId = payer.payerPersonId;
      const isPlayerKind = registration.kind === "player";
      // Un socio no tiene tallas ni pide consentimiento de imagen/traslados: si
      // se incluyeran aquí, aprobar su alta borraría esos datos de una persona
      // que ya fuera jugador (ver MEMBER_UPDATE_FIELDS).
      const sizeFields = isPlayerKind
        ? { shirtSize: registration.shirtSize, pantsSize: registration.pantsSize, shoeSize: registration.shoeSize }
        : {};
      const kitConsentFields = isPlayerKind
        ? {
            photoConsent: registration.photoConsent,
            photoConsentAt: registration.photoConsentAt,
            termsConsent: registration.termsConsent,
            termsConsentAt: registration.termsConsentAt,
          }
        : {};

      if (matchedPersonId !== "new") {
        personId = matchedPersonId;
        const existingPerson = await tx.query.persons.findFirst({
          where: eq(persons.id, personId),
          columns: {
            firstName: true,
            lastName: true,
            birthDate: true,
            nationalId: true,
            address: true,
            city: true,
            postalCode: true,
            phone: true,
            email: true,
            iban: true,
            shirtSize: true,
            pantsSize: true,
            shoeSize: true,
          },
        });
        const fields = applyKeepOverrides(
          {
            firstName: registration.firstName,
            lastName: registration.lastName,
            birthDate: registration.birthDate,
            nationalId: registration.nationalId,
            address: registration.address,
            city: registration.city,
            postalCode: registration.postalCode,
            phone: registration.phone,
            email: registration.email,
            iban: payer.iban,
            ...sizeFields,
          },
          existingPerson ?? null,
          formData,
          "person",
          isPlayerKind
            ? payerPersonId
              ? PERSON_UPDATE_FIELDS_WITHOUT_IBAN
              : PERSON_UPDATE_FIELDS
            : payerPersonId
              ? MEMBER_UPDATE_FIELDS_WITHOUT_IBAN
              : MEMBER_UPDATE_FIELDS,
        );
        await tx
          .update(persons)
          .set({
            ...fields,
            ...kitConsentFields,
            privacyConsent: registration.privacyConsent,
            privacyConsentAt: registration.privacyConsentAt,
            sepaConsent: payer.sepaConsent,
            sepaConsentAt: payer.sepaConsent ? registration.sepaConsentAt : null,
            payerPersonId,
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
            postalCode: registration.postalCode,
            phone: registration.phone,
            email: registration.email,
            iban: payer.iban,
            ...sizeFields,
            ...kitConsentFields,
            privacyConsent: registration.privacyConsent,
            privacyConsentAt: registration.privacyConsentAt,
            sepaConsent: payer.sepaConsent,
            sepaConsentAt: payer.sepaConsent ? registration.sepaConsentAt : null,
            payerPersonId,
          })
          .returning({ id: persons.id });
        personId = inserted.id;
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
          .values({ personId, teamId, role: membershipRole })
          .onConflictDoNothing();
      } else if (registration.kind === "member") {
        // Alta de socio: sin equipo, cuelga de `club_members` en vez de `memberships`.
        // Si la persona ya fue socia y causó baja, reactivamos en vez de duplicar
        // (índice único por `personId`).
        await tx
          .insert(clubMembers)
          .values({ personId, status: "active", joinedAt: new Date().toISOString().slice(0, 10) })
          .onConflictDoUpdate({
            target: clubMembers.personId,
            set: { status: "active", cancelledAt: null },
          });
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

  // Foto y DNI son, como los campos de texto, valores únicos por persona que
  // esta aprobación podría sobrescribir: si se vincula con una persona
  // existente y el revisor ha marcado "mantener el actual" (ver el diff en
  // `review-form.tsx`), no se tocan. Al crear una persona nueva no hay nada
  // que mantener, así que siempre se aplican.
  const keepExistingFile = (key: "photo" | "idFront" | "idBack") =>
    matchedPersonId !== "new" && formData.get(`keep_person_${key}`) === "on";

  if (registration.photoPath && !keepExistingFile("photo")) {
    const targetPath = `${personId}/photo.${extFromPath(registration.photoPath)}`;
    await copyFileBetweenBuckets(
      REGISTRATION_BUCKET,
      registration.photoPath,
      PERSON_PHOTO_BUCKET,
      targetPath,
    );
    await regeneratePersonPhotoThumb(targetPath);
    await db.update(persons).set({ photoPath: targetPath }).where(eq(persons.id, personId));
  }

  if (registration.idFrontPath && !keepExistingFile("idFront")) {
    const targetPath = `${personId}/id-front.${extFromPath(registration.idFrontPath)}`;
    await copyFileBetweenBuckets(REGISTRATION_BUCKET, registration.idFrontPath, PERSON_DOCUMENTS_BUCKET, targetPath);
    await db.update(persons).set({ idFrontPath: targetPath }).where(eq(persons.id, personId));
  }

  if (registration.idBackPath && !keepExistingFile("idBack")) {
    const targetPath = `${personId}/id-back.${extFromPath(registration.idBackPath)}`;
    await copyFileBetweenBuckets(REGISTRATION_BUCKET, registration.idBackPath, PERSON_DOCUMENTS_BUCKET, targetPath);
    await db.update(persons).set({ idBackPath: targetPath }).where(eq(persons.id, personId));
  }

  updateTag(INTEGRITY_ISSUES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(
    ROUTE.inscripciones,
    ROUTE.inscripcionFicha,
    ROUTE.socios,
    ROUTE.socioFicha,
    ROUTE.personas,
    ROUTE.personaFicha,
    ROUTE.equipoFicha,
    ROUTE.dashboard,
  );
  return { message: t("registrationApproved") };
}

export async function rejectRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");

  const id = String(formData.get("id") ?? "");
  const registration = await db.query.registrations.findFirst({ where: eq(registrations.id, id) });
  if (!registration) return { error: t("notFound") };
  const reviewer = await requirePermission(
    registration.kind === "member" ? ["inscripciones.manage", "socios.manage"] : "inscripciones.manage",
  );
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();
  if (!rejectionReason) return { error: t("rejectionReasonRequired") };
  if (registration.status !== "pending") return { error: t("alreadyReviewed") };

  await db
    .update(registrations)
    .set({ status: "rejected", reviewedBy: reviewer.id, reviewedAt: new Date(), rejectionReason })
    .where(eq(registrations.id, id));

  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(
    ROUTE.inscripciones,
    ROUTE.inscripcionFicha,
    ROUTE.socios,
    ROUTE.socioFicha,
    ROUTE.dashboard,
  );
  return { message: t("registrationRejected") };
}

/**
 * Reabre una solicitud rechazada a `pending`. Deliberadamente no existe el
 * equivalente para una aprobada: aprobar puede haber creado/actualizado una
 * persona, sus tutores, su membership/condición de socio y copiado ficheros
 * ya integrados, y deshacer eso de forma segura es un problema de
 * reconciliación de datos, no un simple cambio de estado.
 */
export async function reopenRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");

  const id = String(formData.get("id") ?? "");
  const registration = await db.query.registrations.findFirst({ where: eq(registrations.id, id) });
  if (!registration) return { error: t("notFound") };
  await requirePermission(
    registration.kind === "member" ? ["inscripciones.manage", "socios.manage"] : "inscripciones.manage",
  );
  if (registration.status !== "rejected") return { error: t("onlyRejectedCanReopen") };

  await db
    .update(registrations)
    .set({ status: "pending", reviewedBy: null, reviewedAt: null, rejectionReason: null })
    .where(eq(registrations.id, id));

  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(
    ROUTE.inscripciones,
    ROUTE.inscripcionFicha,
    ROUTE.socios,
    ROUTE.socioFicha,
    ROUTE.dashboard,
  );
  return { message: t("registrationReopened") };
}

/**
 * Borra definitivamente una solicitud rechazada: la fila (sus tutores caen por
 * `on delete cascade`) y los ficheros que subió el solicitante. Solo rechazadas
 * —una aprobada ya creó persona, tutores, membership y copias de sus ficheros,
 * y una pendiente está aún por revisar—. Al no haber aprobación no existe copia
 * en `person-photos`/`person-documents`, así que limpiar el bucket de
 * inscripciones no deja a nadie sin foto.
 */
export async function deleteRegistration(
  _prev: RegistrationReviewState,
  formData: FormData,
): Promise<RegistrationReviewState> {
  const t = await getTranslations("Inscripciones");

  const id = String(formData.get("id") ?? "");
  const registration = await db.query.registrations.findFirst({
    where: eq(registrations.id, id),
    columns: { kind: true, status: true, photoPath: true, idFrontPath: true, idBackPath: true },
  });
  if (!registration) return { error: t("notFound") };
  await requirePermission(
    registration.kind === "member" ? ["inscripciones.manage", "socios.manage"] : "inscripciones.manage",
  );
  if (registration.status !== "rejected") return { error: t("onlyRejectedCanDelete") };

  await db.delete(registrations).where(eq(registrations.id, id));

  const { photoPath, idFrontPath, idBackPath } = registration;
  const paths = [
    photoPath,
    photoPath ? personPhotoThumbPath(photoPath) : null,
    idFrontPath,
    idBackPath,
  ].filter((path): path is string => Boolean(path));
  await Promise.all(paths.map((path) => removeFile(REGISTRATION_BUCKET, path)));

  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(
    ROUTE.inscripciones,
    ROUTE.inscripcionFicha,
    ROUTE.socios,
    ROUTE.socioFicha,
    ROUTE.dashboard,
  );

  // Desde el detalle la fila ya no existe y la página daría 404, así que la
  // acción se lleva al listado; desde el propio listado no hay redirección y
  // se ve el toast de confirmación.
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (redirectTo) redirect({ href: redirectTo, locale: await getLocale() });

  return { message: t("registrationDeleted") };
}
