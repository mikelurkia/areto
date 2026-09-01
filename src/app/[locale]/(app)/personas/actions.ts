"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  bootType,
  clubMembers,
  injuryPlace,
  matchMinute,
  memberships,
  personDocuments,
  personGuardians,
  personInjuryReports,
  personMedicalCheckups,
  personNotes,
  personQualifications,
  personTags,
  persons,
  pitchSurface,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { nextConsentAt, stampConsent } from "@/lib/consent";
import { DUPLICATE_PERSONS_TAG, INTEGRITY_ISSUES_TAG } from "@/lib/data-integrity";
import { SEASON_RENEWALS_TAG } from "@/lib/season-renewals";
import { UNIQUE_VIOLATION, isPostgresError, postgresConstraint } from "@/lib/db-errors";
import { makeDocumentActions } from "@/lib/entity-documents";
import { makeNoteActions } from "@/lib/entity-notes";
import { isValidIban } from "@/lib/iban";
import { isValidNationalId } from "@/lib/national-id";
import { resizeImageToWebp } from "@/lib/image-resize";
import { findCandidates } from "@/lib/person-matching";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { getClubSettings } from "@/lib/club";
import { mailtoLink } from "@/lib/contact-links";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
  fillInjuryReportPdf,
} from "@/lib/injury-report-pdf";
import { resolvePayerFields } from "@/lib/payer";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import { revokeMandate } from "@/lib/sepa";
import {
  createSignedUrl,
  extensionFromMimeType,
  fileExists,
  getSignedUrl,
  removeFile,
  uploadFile,
} from "@/lib/supabase/storage";
import type { PersonCandidate } from "@/components/match-select";

export type PersonState = {
  error?: string;
  message?: string;
  /** Presente cuando `createPerson` encuentra alguien parecido y espera que el
   * usuario elija "vincular" o "crear de todas formas" antes de continuar. */
  candidates?: PersonCandidate[];
  submittedFields?: Record<string, string | null>;
  /**
   * Fichero que el navegador tiene que descargar en cuanto vuelva la acción.
   * Lo usa el parte de lesión: generarlo y bajárselo son el mismo gesto, no dos
   * pasos. Solo lo puede hacer el cliente, así que la acción se limita a decir
   * qué bajar (ver `InjuryReportForm`).
   */
  download?: { url: string; filename: string };
  /**
   * Navegación que hace el cliente después de procesar el resto del estado. Un
   * `redirect()` del servidor cortaría la respuesta y con ella el `download`,
   * así que las acciones que además tienen que llevar a otra URL la devuelven
   * aquí en vez de redirigir ellas.
   */
  redirectTo?: string;
  /**
   * `mailto:` que el cliente tiene que abrir tras procesar el resto del
   * estado (ver `download`/`redirectTo`, mismo mecanismo): el servidor no
   * puede abrir el cliente de correo del usuario, así que deja dicho a dónde
   * ir. Lo usa el envío del parte de lesión a la persona o a su tutor/a.
   */
  mailto?: string;
};

const PHOTO_BUCKET = "person-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// La foto se ve casi siempre como avatar pequeño (plantilla, panel de
// familia, carné, listados); solo la ficha de la persona enlaza al original a
// tamaño completo, para poder descargarlo y usarlo en trámites federativos.
// Por eso se sube dos veces: el original tal cual, y esta miniatura ligera.
const PHOTO_THUMB_MAX_DIMENSION = 256;

async function uploadPersonPhoto(personId: string, file: File): Promise<string> {
  const path = `${personId}/photo.${extensionFromMimeType(file.type)}`;
  const thumb = await resizeImageToWebp(file, PHOTO_THUMB_MAX_DIMENSION);
  await Promise.all([
    uploadFile(PHOTO_BUCKET, path, file),
    uploadFile(PHOTO_BUCKET, personPhotoThumbPath(path), thumb),
  ]);
  return path;
}

async function removePersonPhotoObject(path: string) {
  await Promise.all([
    removeFile(PHOTO_BUCKET, path),
    removeFile(PHOTO_BUCKET, personPhotoThumbPath(path)),
  ]);
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
/** Caducidad del enlace firmado que se manda por correo: horas de sobra para
 * que el destinatario, sin cuenta en la app, lo abra, sin dejar la ventana de
 * exposición de un documento médico abierta una semana. */
const SEND_INJURY_REPORT_LINK_EXPIRY_SECONDS = 60 * 60 * 48;
/** Prefijo del valor de `recipient` en el formulario de envío cuando el
 * destinatario elegido es un tutor/a y no la propia persona. */
const RECIPIENT_GUARDIAN_PREFIX = "guardian:";
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
 * Nombre con el que se baja el PDF del parte. En Storage el objeto se llama
 * como el id del parte (un UUID), que en la carpeta de descargas de quien lo
 * tramita no dice nada: la Mutualidad los recibe por jugador y fecha.
 */
function injuryReportDownloadName(fullName: string, occurredOn: string): string {
  const slug = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `parte_lesion_${slug || "jugador"}_${occurredOn}.pdf`;
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Reemplaza los tutores de una persona: borra los actuales e inserta los
 * nuevos (el primero, principal).
 *
 * Exige un `tx` y no `db` porque es un DELETE + INSERT: si el insert falla por
 * su cuenta, la persona se queda **sin ningún tutor**, y eso además invalida
 * el `payerPersonId` que se acaba de escribir en su ficha.
 */
async function replaceGuardians(tx: Tx, personId: string, guardianIds: string[]) {
  await tx.delete(personGuardians).where(eq(personGuardians.personId, personId));
  if (guardianIds.length === 0) return;
  await tx.insert(personGuardians).values(
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

/** Nombre de la restricción única que violó el error, o `null` si no es un 23505. */
function uniqueViolationConstraint(error: unknown): string | null {
  return isPostgresError(error, UNIQUE_VIOLATION) ? postgresConstraint(error) : null;
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
  tx: Tx,
  personId: string,
  isMember: boolean,
  memberNumber: number | null,
) {
  const existing = await tx.query.clubMembers.findFirst({
    where: eq(clubMembers.personId, personId),
  });
  if (isMember) {
    if (existing) {
      await tx
        .update(clubMembers)
        .set({ status: "active", memberNumber, cancelledAt: null })
        .where(eq(clubMembers.id, existing.id));
    } else {
      await tx.insert(clubMembers).values({
        personId,
        status: "active",
        memberNumber,
        joinedAt: today(),
      });
    }
  } else if (existing && existing.status === "active") {
    await tx
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
    postalCode: String(formData.get("postalCode") ?? "").trim(),
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
  "postalCode",
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
  const user = await requirePermission("personas.manage");

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
        postalCode: true,
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
          postalCode: fields.postalCode || null,
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

      /*
       * Dentro del mismo `tx` que el insert: si el alta de socio choca con un
       * `member_number` ya usado, o falla el enlace de tutores, la persona no
       * puede quedarse creada a medias con un `{error}` de vuelta.
       */
      await syncClubMembership(tx, person.id, fields.isMember, fields.memberNumber);
      await replaceGuardians(tx, person.id, guardianIds);

      return person.id;
    });
  } catch (error) {
    const message = uniqueViolationMessage(error, t);
    if (message) return { error: message };
    throw error;
  }

  // La foto va fuera de la transacción: es una subida a Storage, que no se
  // deshace con un ROLLBACK y no debe tener abierta una transacción esperando.
  if (photo) {
    const path = await uploadPersonPhoto(personId, photo);
    await db.update(persons).set({ photoPath: path }).where(eq(persons.id, personId));
  }
  if (payer.iban) {
    await recordAuditEvent({
      actorUserId: user.id,
      action: "create",
      entityType: "person_banking",
      entityId: personId,
    });
  }

  updateTag(DUPLICATE_PERSONS_TAG);
  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha, ROUTE.socios, ROUTE.medico);
  return { message: t("personCreated") };
}

export async function updatePerson(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.manage");

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
      iban: true,
    },
  });

  // Los consentimientos no se editan desde esta ficha: se conservan tal cual
  // están (ver comentario en `readPersonFields`). Un tutor nuevo sí puede
  // anular el SEPA propio de la persona, igual que antes.
  const payer = resolvePayerFields(guardianIds, fields.iban || null, existing?.sepaConsent ?? false);

  /*
   * Las tres escrituras van juntas o no van: `replaceGuardians` es un DELETE +
   * INSERT, así que un fallo a mitad dejaba a la persona sin tutores y con el
   * `payerPersonId` recién escrito apuntando a un tutor que ya no consta.
   */
  try {
    await db.transaction(async (tx) => {
      await tx
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
          postalCode: fields.postalCode || null,
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
      await syncClubMembership(tx, id, fields.isMember, fields.memberNumber);
      await replaceGuardians(tx, id, guardianIds);
    });
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

  // La foto va fuera de la transacción: es una subida a Storage, que no se
  // deshace con un ROLLBACK y no debe tener abierta una transacción esperando.
  if (photo) {
    if (existing?.photoPath) await removePersonPhotoObject(existing.photoPath);
    const path = await uploadPersonPhoto(id, photo);
    await db.update(persons).set({ photoPath: path }).where(eq(persons.id, id));
  } else if (fields.removePhoto && existing?.photoPath) {
    await removePersonPhotoObject(existing.photoPath);
    await db.update(persons).set({ photoPath: null }).where(eq(persons.id, id));
  }
  if (existing && existing.iban !== payer.iban) {
    await recordAuditEvent({
      actorUserId: user.id,
      action: "update",
      entityType: "person_banking",
      entityId: id,
    });
  }

  updateTag(DUPLICATE_PERSONS_TAG);
  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha, ROUTE.socios, ROUTE.medico);
  return { message: t("personUpdated") };
}

/** Cambia solo la foto, sin reenviar el resto de la ficha (botón junto al avatar). */
export async function updatePersonPhoto(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.manage");

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

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
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
  await requirePermission("personas.manage");

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

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
  return { message: t("idScanUpdated") };
}

export async function deletePerson(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.manage");

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.persons.findFirst({
    where: eq(persons.id, id),
    columns: { photoPath: true },
  });

  await db.delete(persons).where(eq(persons.id, id));
  if (existing?.photoPath) await removePersonPhotoObject(existing.photoPath);

  updateTag(DUPLICATE_PERSONS_TAG);
  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha, ROUTE.socios, ROUTE.medico);
  return { message: t("personDeleted") };
}

/** Revoca la domiciliación SEPA activa de la persona pagadora (ficha bancaria). */
export async function revokePersonMandate(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.banking.manage");

  const payerPersonId = String(formData.get("payerPersonId") ?? "");

  await revokeMandate(payerPersonId);
  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "sepa_mandate",
    entityId: payerPersonId,
    metadata: { revoked: true },
  });

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
  return { message: t("mandateRevoked") };
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
  await requirePermission("personas.manage");

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

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
  return { message: t("qualificationAdded") };
}

export async function updateQualification(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.manage");

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

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
  return { message: t("qualificationUpdated") };
}

export async function deleteQualification(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.manage");

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.personQualifications.findFirst({
    where: eq(personQualifications.id, id),
    columns: { filePath: true },
  });

  await db.delete(personQualifications).where(eq(personQualifications.id, id));
  if (existing?.filePath) await removeQualificationFileObject(existing.filePath);

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
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
  const user = await requirePermission("personas.medical.manage");

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
  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "person_medical_checkup",
    entityId: checkup.id,
    metadata: { personId },
  });
  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado, ROUTE.dashboard);
  return { message: t("medicalCheckupAdded") };
}

export async function updateMedicalCheckup(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.medical.manage");

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
  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "person_medical_checkup",
    entityId: id,
    metadata: { personId: existing.personId },
  });
  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado, ROUTE.dashboard);
  return { message: t("medicalCheckupUpdated") };
}

export async function deleteMedicalCheckup(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.medical.manage");

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.personMedicalCheckups.findFirst({
    where: eq(personMedicalCheckups.id, id),
    columns: { personId: true, filePath: true },
  });

  await db.delete(personMedicalCheckups).where(eq(personMedicalCheckups.id, id));
  if (existing?.filePath) await removeMedicalCheckupFileObject(existing.filePath);
  if (existing) await recomputeMedicalCertUntil(existing.personId);
  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "person_medical_checkup",
    entityId: id,
    metadata: existing ? { personId: existing.personId } : undefined,
  });

  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado, ROUTE.dashboard);
  return { message: t("medicalCheckupDeleted") };
}

export async function deleteInjuryReport(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.medical.manage");

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, id),
    columns: { filePath: true },
  });

  await db.delete(personInjuryReports).where(eq(personInjuryReports.id, id));
  if (existing?.filePath) await removeInjuryReportFileObject(existing.filePath);
  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "person_injury_report",
    entityId: id,
  });

  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado);
  return { message: t("injuryReportDeleted") };
}

/**
 * Lee un valor de un enum de Postgres desde el formulario. Los `<select>` solo
 * ofrecen valores válidos, pero un POST a mano puede mandar cualquier cosa: lo
 * que no esté en el enum se guarda como NULL (casilla en blanco del impreso) en
 * vez de reventar el UPDATE.
 */
/** Un id de la aplicación siempre es un UUID (ver las PK de `schema.ts`). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readEnum<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = String(formData.get(key) ?? "").trim();
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Las preguntas de sí/no del impreso tienen tres estados, no dos: sí, no, y
 * "aún no se ha contestado". De ahí el `boolean` nullable en vez de un
 * `default false`, que imprimiría un "NO" que nadie ha dicho.
 */
function readTristate(formData: FormData, key: string): boolean | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

/**
 * Guarda de una vez las notas del parte, las casillas del impreso oficial de
 * la Mutualidad y regenera el fichero del parte con esos datos: una sola
 * acción para lo que antes eran tres pasos (alta, guardar impreso, generar
 * fichero). Sin `id` es un alta: inserta con la fecha de hoy —el parte se abre
 * el mismo día de la lesión, no se pide en el formulario— y devuelve la URL
 * canónica del parte ya creado para que el cliente navegue a ella. Si falta la
 * plantilla o los datos del club, el guardado de los campos igualmente tiene
 * éxito — solo el fichero se queda sin generar, con aviso.
 *
 * El fichero generado vuelve en `download` para que el navegador se lo baje sin
 * un segundo clic.
 */
export async function saveInjuryReportAndGenerate(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.medical.manage");

  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  let personId = String(formData.get("personId") ?? "");
  if (id) {
    const existing = await db.query.personInjuryReports.findFirst({
      where: eq(personInjuryReports.id, id),
      columns: { personId: true },
    });
    if (!existing) return { error: t("injuryReportNotFound") };
    personId = existing.personId;
  }

  // El equipo es obligatorio y tiene que ser uno en el que esta persona esté
  // fichada: el parte lo cubre la licencia federativa del jugador con ese
  // equipo, y de él salen además la categoría de licencia, el sexo y el puesto
  // del impreso. Sin ficha en ningún equipo no hay parte que tramitar, así que
  // esto no es solo validación de formulario — es la regla del trámite.
  //
  // Se descarta lo que no tenga forma de UUID antes de consultar, y no solo por
  // prudencia: comparar con una columna `uuid` algo que no lo es es un error de
  // Postgres, no una fila que no aparece.
  const requestedTeamId = String(formData.get("teamId") ?? "").trim();
  if (!UUID.test(requestedTeamId)) return { error: t("injuryReportTeamRequired") };
  // `positions` se lee ya aquí: es el puesto que va al impreso más abajo, y
  // volver a buscar la misma ficha para eso sería una consulta de más.
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.personId, personId), eq(memberships.teamId, requestedTeamId)),
    columns: { teamId: true, positions: true },
  });
  if (!membership) return { error: t("injuryReportTeamNotFound") };
  const teamId = membership.teamId;

  const rawMinutes = String(formData.get("weeklyTrainingMinutes") ?? "").trim();
  const weeklyTrainingMinutes = rawMinutes ? Number(rawMinutes) : null;
  if (
    weeklyTrainingMinutes !== null &&
    (!Number.isInteger(weeklyTrainingMinutes) || weeklyTrainingMinutes < 0)
  ) {
    return { error: t("injuryReportWeeklyMinutesInvalid") };
  }

  const federationFields = {
    teamId,
    reportedOn: String(formData.get("reportedOn") ?? "").trim() || null,
    reportedPlace: String(formData.get("reportedPlace") ?? "").trim() || null,
    place: readEnum(formData, "place", injuryPlace.enumValues),
    placeOther: String(formData.get("placeOther") ?? "").trim() || null,
    matchMinute: readEnum(formData, "matchMinute", matchMinute.enumValues),
    surface: readEnum(formData, "surface", pitchSurface.enumValues),
    collision: readTristate(formData, "collision"),
    opponentTeam: String(formData.get("opponentTeam") ?? "").trim() || null,
    relatedToPrevious: readTristate(formData, "relatedToPrevious"),
    bootType: readEnum(formData, "bootType", bootType.enumValues),
    trainingSurface: readEnum(formData, "trainingSurface", pitchSurface.enumValues),
    weeklyTrainingMinutes,
  };

  let reportId = id;
  if (!id) {
    const [inserted] = await db
      .insert(personInjuryReports)
      .values({
        personId,
        occurredOn: today(),
        notes: notes || null,
        ...federationFields,
      })
      .returning({ id: personInjuryReports.id });
    reportId = inserted.id;
  } else {
    // `occurredOn` no se toca: se fijó al crear el parte y no viene del
    // formulario, así que editar las casillas del impreso no puede moverlo.
    await db
      .update(personInjuryReports)
      .set({
        notes: notes || null,
        ...federationFields,
      })
      .where(eq(personInjuryReports.id, id));
  }

  // Igual que hacía `generateInjuryReportFile`: rellena la plantilla y guarda el
  // PDF como el fichero del registro. Si falta la plantilla o los datos del
  // club, el parte ya se ha guardado igualmente — no se hace fallar la acción
  // entera por no poder generar el fichero.
  const hasTemplate = await fileExists(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH);
  const club = await getClubSettings();
  const canGenerate = hasTemplate && !!club?.federationDelegation && !!club?.signatoryName;

  let download: PersonState["download"];
  if (canGenerate) {
    const report = await db.query.personInjuryReports.findFirst({
      where: eq(personInjuryReports.id, reportId),
      with: { person: true, team: true },
    });
    if (report) {
      const pdf = await fillInjuryReportPdf({
        report,
        person: report.person,
        team: report.team,
        positions: membership.positions,
        club,
      });
      const file = new File([pdf], "parte.pdf", { type: "application/pdf" });

      if (report.filePath) await removeInjuryReportFileObject(report.filePath);
      const path = await uploadInjuryReportFile(report.personId, reportId, file);
      await db
        .update(personInjuryReports)
        .set({ filePath: path })
        .where(eq(personInjuryReports.id, reportId));

      // El fichero se baja solo al volver la acción: el parte se genera para
      // imprimirlo y llevarlo al médico, así que pedirlo y descargarlo son el
      // mismo gesto. La URL es la del proxy de Storage (comprueba la sesión y
      // el permiso en cada petición), con el nombre útil que el UUID no da.
      const url = await getSignedUrl(INJURY_REPORTS_BUCKET, path);
      if (url) {
        const filename = injuryReportDownloadName(
          `${report.person.firstName} ${report.person.lastName}`,
          report.occurredOn,
        );
        // El `v` no lo lee nadie: está para que el navegador no sirva de su
        // caché el PDF anterior. El fichero de un parte se sobreescribe siempre
        // en la misma ruta, y el proxy de Storage responde con una hora de
        // `max-age`, así que sin esto regenerar un parte bajaría el de antes.
        download = {
          url: `${url}?filename=${encodeURIComponent(filename)}&v=${Date.now()}`,
          filename,
        };
      }
    }
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: id ? "update" : "create",
    entityType: "person_injury_report",
    entityId: reportId,
    metadata: { personId },
  });
  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado);

  return {
    message: canGenerate ? t("injuryReportSaved") : t("injuryReportSavedNoFile"),
    download,
    // En el alta la URL definitiva del parte solo se conoce ahora. La
    // navegación la hace el cliente y no un `redirect()` de aquí: redirigir
    // descartaría el estado, y con él la descarga que se acaba de preparar.
    redirectTo: id ? undefined : `/personas/${personId}/parte-lesion/${reportId}`,
  };
}

/** Sube un fichero propio como el fichero del parte, reemplazando el que hubiera. */
export async function uploadInjuryReportCustomFile(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.medical.manage");

  const id = String(formData.get("id") ?? "");
  const file = readMedicalFile(formData);
  if (!file) return { error: t("injuryReportFileRequired") };
  if (!ALLOWED_MEDICAL_FILE_TYPES.includes(file.type)) {
    return { error: t("injuryReportFileInvalidType") };
  }
  if (file.size > MAX_MEDICAL_FILE_BYTES) {
    return { error: t("injuryReportFileTooLarge") };
  }

  const existing = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, id),
    columns: { personId: true, filePath: true },
  });
  if (!existing) return { error: t("injuryReportNotFound") };

  if (existing.filePath) await removeInjuryReportFileObject(existing.filePath);
  const path = await uploadInjuryReportFile(existing.personId, id, file);
  await db
    .update(personInjuryReports)
    .set({ filePath: path })
    .where(eq(personInjuryReports.id, id));
  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "person_injury_report",
    entityId: id,
    metadata: { personId: existing.personId, file: "replaced" },
  });

  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado);
  return { message: t("injuryReportFileUploaded") };
}

/** Borra el fichero del parte sin borrar el registro: queda listo para generarlo de nuevo o subir otro. */
export async function deleteInjuryReportFile(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.medical.manage");

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, id),
    columns: { filePath: true },
  });
  if (!existing) return { error: t("injuryReportNotFound") };
  if (!existing.filePath) return { message: t("injuryReportFileDeleted") };

  await removeInjuryReportFileObject(existing.filePath);
  await db
    .update(personInjuryReports)
    .set({ filePath: null })
    .where(eq(personInjuryReports.id, id));
  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "person_injury_report",
    entityId: id,
    metadata: { file: "removed" },
  });

  revalidateRoutes(ROUTE.personaFicha, ROUTE.medico, ROUTE.medicoListado);
  return { message: t("injuryReportFileDeleted") };
}

/**
 * Manda el fichero del parte a la persona o a su tutor/a por correo. No hay
 * proveedor de email en el servidor (ver `mailtoLink`): la acción solo firma
 * un enlace de descarga que funciona sin sesión y deja el `mailto:` para que
 * lo abra el cliente (ver `PersonState.mailto`), con el propio correo del
 * usuario como remitente.
 */
export async function sendInjuryReportByEmail(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.medical.manage");

  const id = String(formData.get("id") ?? "");
  const recipient = String(formData.get("recipient") ?? "");

  const report = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, id),
    columns: { personId: true, occurredOn: true, filePath: true },
    with: { person: { columns: { firstName: true, lastName: true, email: true } } },
  });
  if (!report) return { error: t("injuryReportNotFound") };
  if (!report.filePath) return { error: t("sendInjuryReportNoFileError") };

  let recipientName: string;
  let recipientEmail: string | null;
  if (recipient.startsWith(RECIPIENT_GUARDIAN_PREFIX)) {
    const guardianId = recipient.slice(RECIPIENT_GUARDIAN_PREFIX.length);
    const guardianRow = await db.query.personGuardians.findFirst({
      where: and(
        eq(personGuardians.personId, report.personId),
        eq(personGuardians.guardianId, guardianId),
      ),
      with: { guardian: { columns: { firstName: true, lastName: true, email: true } } },
    });
    if (!guardianRow) return { error: t("sendInjuryReportNoRecipientError") };
    recipientName = `${guardianRow.guardian.firstName} ${guardianRow.guardian.lastName}`;
    recipientEmail = guardianRow.guardian.email;
  } else {
    if (recipient !== "person") return { error: t("sendInjuryReportNoRecipientError") };
    recipientName = `${report.person.firstName} ${report.person.lastName}`;
    recipientEmail = report.person.email;
  }
  if (!recipientEmail) return { error: t("sendInjuryReportNoEmailError") };

  const url = await createSignedUrl(
    INJURY_REPORTS_BUCKET,
    report.filePath,
    SEND_INJURY_REPORT_LINK_EXPIRY_SECONDS,
  );
  if (!url) return { error: t("sendInjuryReportLinkError") };

  const club = await getClubSettings();
  const personName = `${report.person.firstName} ${report.person.lastName}`;
  const subject = t("sendInjuryReportSubject", { name: personName });
  const body = t("sendInjuryReportBody", {
    recipientName,
    name: personName,
    date: report.occurredOn,
    club: club?.legalName ?? "Areto",
    url,
  });

  return {
    message: t("sendInjuryReportSent"),
    mailto: mailtoLink(recipientEmail, subject, body),
  };
}

const personDocumentActions = makeDocumentActions({
  table: personDocuments,
  bucket: "person-documents",
  parentIdColumn: "personId",
  formKey: "personId",
  namespace: "Personas",
  permission: "personas.manage",
  routes: [ROUTE.personaFicha],
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
  await requirePermission("personas.manage");

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
      revalidateRoutes(ROUTE.personas, ROUTE.personaFicha, ROUTE.socios);
      return { message: t("memberNumberAssigned", { number: next }) };
    } catch (error) {
      if (uniqueViolationConstraint(error) === "club_members_member_number_idx") continue;
      throw error;
    }
  }
  return { error: t("memberNumberAssignFailed") };
}

export async function bulkSetMember(personIds: string[], isMember: boolean): Promise<void> {
  await requirePermission("personas.manage");
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

  revalidateRoutes(ROUTE.personas, ROUTE.socios);
}

const BULK_MEMBERSHIP_ROLES = ["player", "coach", "staff"] as const;
type BulkMembershipRole = (typeof BULK_MEMBERSHIP_ROLES)[number];

export async function bulkAddToTeam(
  personIds: string[],
  teamId: string,
  role: BulkMembershipRole,
): Promise<void> {
  await requirePermission("personas.manage");
  if (personIds.length === 0 || !teamId) return;
  const safeRole = (BULK_MEMBERSHIP_ROLES as readonly string[]).includes(role)
    ? role
    : "player";

  await db
    .insert(memberships)
    .values(personIds.map((personId) => ({ personId, teamId, role: safeRole })))
    .onConflictDoNothing();

  updateTag(INTEGRITY_ISSUES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(ROUTE.personas, ROUTE.equipos, ROUTE.equipoFicha, ROUTE.dashboard);
}

const personNoteActions = makeNoteActions({
  table: personNotes,
  parentIdColumn: "personId",
  formKey: "personId",
  namespace: "Personas",
  permission: "personas.manage",
  routes: [ROUTE.personaFicha],
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
  await requirePermission("personas.manage");

  const personId = String(formData.get("personId") ?? "");
  const tag = normalizeTag(String(formData.get("tag") ?? ""));
  if (!tag) return { error: t("tagRequired") };

  await db.insert(personTags).values({ personId, tag }).onConflictDoNothing();

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
  return { message: t("tagAdded") };
}

export async function deletePersonTag(
  _prev: PersonState,
  formData: FormData,
): Promise<PersonState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.manage");

  const id = String(formData.get("id") ?? "");
  await db.delete(personTags).where(eq(personTags.id, id));

  revalidateRoutes(ROUTE.personas, ROUTE.personaFicha);
  return { message: t("tagDeleted") };
}
