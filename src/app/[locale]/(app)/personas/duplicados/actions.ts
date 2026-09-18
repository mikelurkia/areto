"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  clubMembers,
  issuedInvoices,
  memberships,
  personDocuments,
  personGuardians,
  personInjuryReports,
  personMedicalCheckups,
  personNotes,
  personQualifications,
  personTags,
  persons,
  registrationGuardians,
  registrations,
  sepaCharges,
  sepaMandates,
  sponsors,
  users,
} from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { DUPLICATE_PERSONS_TAG, INTEGRITY_ISSUES_TAG } from "@/lib/data-integrity";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { createClient } from "@/lib/supabase/server";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type MergeState = {
  error?: string;
  message?: string;
};

const PHOTO_BUCKET = "person-photos";

/**
 * Campos que la fusión puede tomar de una ficha o de la otra. El diálogo manda
 * un `campo.<nombre>` por cada uno; si no llega ninguno —fusión sin elección—
 * se mantiene el criterio de siempre: gana el valor de la principal y el del
 * duplicado solo rellena huecos.
 *
 * Fuera quedan a propósito los consentimientos (`photoConsent`, `sepaConsent`):
 * no se eligen, se suman, porque un consentimiento dado no se puede retirar
 * marcando la otra columna.
 */
const MERGEABLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "birthDate",
  "nationalId",
  "address",
  "city",
  "postalCode",
  "iban",
  "medicalCertUntil",
  "shirtSize",
  "pantsSize",
  "shoeSize",
  "photoPath",
] as const;

export type MergeableField = (typeof MERGEABLE_FIELDS)[number];

type PersonRow = typeof persons.$inferSelect;

/** Qué ficha aporta un campo, según lo marcado en el diálogo. */
function chosen<F extends MergeableField>(
  formData: FormData,
  field: F,
  primary: PersonRow,
  duplicate: PersonRow,
): PersonRow[F] {
  const choice = formData.get(`campo.${field}`);
  if (choice === "duplicate") return duplicate[field];
  if (choice === "primary") return primary[field];
  return primary[field] ?? duplicate[field];
}

export type MergePairPerson = Pick<
  typeof persons.$inferSelect,
  MergeableField | "id" | "notes"
>;

/**
 * Las dos fichas a comparar en el diálogo. No valen las filas que el listado ya
 * tiene en el cliente: solo sube 25 por página y la selección sobrevive al
 * cambio de página, así que una de las dos puede no estar.
 */
export async function loadMergePair(
  idA: string,
  idB: string,
): Promise<MergePairPerson[]> {
  const user = await requirePermission("personas.manage");
  if (!idA || !idB || idA === idB) return [];
  const canViewBanking = hasPermission(user, "personas.banking.view");

  const rows = await db.query.persons.findMany({
    where: inArray(persons.id, [idA, idB]),
    columns: {
      id: true,
      notes: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      nationalId: true,
      address: true,
      city: true,
      postalCode: true,
      iban: true,
      medicalCertUntil: true,
      shirtSize: true,
      pantsSize: true,
      shoeSize: true,
      photoPath: true,
    },
  });
  if (rows.length !== 2) return [];
  // Sin `personas.banking.view` el IBAN no sale de aquí: el diálogo es un
  // componente cliente y viajaría en el payload. Con los dos a `null`, la fila
  // del IBAN ni se pinta (`!a && !b` la descarta).
  const visible = canViewBanking ? rows : rows.map((r) => ({ ...r, iban: null }));
  // El orden del `IN` no es el pedido: el diálogo espera [A, B].
  return [visible.find((r) => r.id === idA)!, visible.find((r) => r.id === idB)!];
}

export async function mergePersons(
  _prev: MergeState,
  formData: FormData,
): Promise<MergeState> {
  const t = await getTranslations("Personas");
  const user = await requirePermission("personas.manage");

  const primaryId = String(formData.get("primaryId") ?? "");
  const duplicateId = String(formData.get("duplicateId") ?? "");
  if (!primaryId || !duplicateId || primaryId === duplicateId) {
    return { error: t("mergeInvalidSelection") };
  }

  const [primary, duplicate] = await Promise.all([
    db.query.persons.findFirst({ where: eq(persons.id, primaryId) }),
    db.query.persons.findFirst({ where: eq(persons.id, duplicateId) }),
  ]);
  if (!primary || !duplicate) return { error: t("mergeInvalidSelection") };

  // Dos cuentas de la app no se pueden fusionar sin decidir cuál se cierra, y
  // eso no se decide desde aquí (`users.personId` es único).
  const accounts = await db.query.users.findMany({
    where: inArray(users.personId, [primaryId, duplicateId]),
    columns: { id: true },
  });
  if (accounts.length > 1) return { error: t("mergeBothHaveAccount") };

  // Sin `personas.banking.manage`, la elección de IBAN que venga en el
  // formulario se ignora: quien no puede verlo tampoco decide cuál sobrevive.
  // Queda el criterio por defecto, el de la principal rellenando huecos.
  const canManageBanking = hasPermission(user, "personas.banking.manage");
  const merged = Object.fromEntries(
    MERGEABLE_FIELDS.map((field) => [
      field,
      field === "iban" && !canManageBanking
        ? (primary.iban ?? duplicate.iban)
        : chosen(formData, field, primary, duplicate),
    ]),
  ) as Pick<typeof persons.$inferInsert, MergeableField>;

  const notesChoice = formData.get("campo.notes");
  const notes =
    notesChoice === "primary"
      ? primary.notes
      : notesChoice === "duplicate"
        ? duplicate.notes
        : [primary.notes, duplicate.notes].filter(Boolean).join(" · ") || null;

  // Si las dos tenían foto, la que no se queda pierde su única referencia: hay
  // que sacarla de Storage al terminar.
  let orphanedPhotoPath: string | null = null;
  if (primary.photoPath && duplicate.photoPath && primary.photoPath !== duplicate.photoPath) {
    orphanedPhotoPath =
      merged.photoPath === duplicate.photoPath ? primary.photoPath : duplicate.photoPath;
  }

  await db.transaction(async (tx) => {
    // `email` y `nationalId` son únicos: hay que liberarlos del duplicado ANTES
    // de copiarlos a la principal, porque el índice único se comprueba al
    // ejecutar cada UPDATE, no al final de la transacción — con las dos filas
    // vivas a la vez, copiar el valor a la principal mientras el duplicado
    // todavía lo tiene rompe el índice aunque el duplicado se vaya a borrar dos
    // pasos después.
    await tx
      .update(persons)
      .set({ email: null, nationalId: null })
      .where(eq(persons.id, duplicateId));

    await tx
      .update(persons)
      .set({
        ...merged,
        notes,
        photoConsent: primary.photoConsent || duplicate.photoConsent,
        sepaConsent: primary.sepaConsent || duplicate.sepaConsent,
      })
      .where(eq(persons.id, primaryId));

    // Condición de socio: si ambas tenían fila, gana la de la principal (mismo
    // criterio que el resto de campos); si solo la tenía el duplicado, se
    // reasigna en vez de perderla.
    const [primaryMember, duplicateMember] = await Promise.all([
      tx.query.clubMembers.findFirst({ where: eq(clubMembers.personId, primaryId) }),
      tx.query.clubMembers.findFirst({ where: eq(clubMembers.personId, duplicateId) }),
    ]);
    if (duplicateMember) {
      if (primaryMember) {
        await tx.delete(clubMembers).where(eq(clubMembers.id, duplicateMember.id));
      } else {
        await tx
          .update(clubMembers)
          .set({ personId: primaryId })
          .where(eq(clubMembers.id, duplicateMember.id));
      }
    }

    // Tutores del duplicado (como tutelado): pasan a la principal, salvo que ya
    // tuviera ese mismo tutor (índice único personId+guardianId).
    const dupAsWard = await tx.query.personGuardians.findMany({
      where: eq(personGuardians.personId, duplicateId),
    });
    for (const row of dupAsWard) {
      const clash = await tx.query.personGuardians.findFirst({
        where: and(
          eq(personGuardians.personId, primaryId),
          eq(personGuardians.guardianId, row.guardianId),
        ),
      });
      if (clash) {
        await tx.delete(personGuardians).where(eq(personGuardians.id, row.id));
      } else if (row.guardianId !== primaryId) {
        await tx
          .update(personGuardians)
          .set({ personId: primaryId })
          .where(eq(personGuardians.id, row.id));
      } else {
        // El duplicado tenía como tutor a la propia principal: no tiene sentido tras la fusión.
        await tx.delete(personGuardians).where(eq(personGuardians.id, row.id));
      }
    }

    // Filas donde el duplicado era tutor de alguien: pasan a la principal.
    const dupAsGuardian = await tx.query.personGuardians.findMany({
      where: eq(personGuardians.guardianId, duplicateId),
    });
    for (const row of dupAsGuardian) {
      if (row.personId === primaryId) {
        await tx.delete(personGuardians).where(eq(personGuardians.id, row.id));
        continue;
      }
      const clash = await tx.query.personGuardians.findFirst({
        where: and(
          eq(personGuardians.personId, row.personId),
          eq(personGuardians.guardianId, primaryId),
        ),
      });
      if (clash) {
        await tx.delete(personGuardians).where(eq(personGuardians.id, row.id));
      } else {
        await tx
          .update(personGuardians)
          .set({ guardianId: primaryId })
          .where(eq(personGuardians.id, row.id));
      }
    }

    // Fichas de equipo: reasignar, y si ya existe la misma (persona, equipo)
    // en la principal, descartar la del duplicado en vez de chocar con el índice único.
    const dupMemberships = await tx.query.memberships.findMany({
      where: eq(memberships.personId, duplicateId),
    });
    for (const m of dupMemberships) {
      const clash = await tx.query.memberships.findFirst({
        where: and(
          eq(memberships.personId, primaryId),
          eq(memberships.teamId, m.teamId),
        ),
      });
      if (clash) {
        await tx.delete(memberships).where(eq(memberships.id, m.id));
      } else {
        await tx
          .update(memberships)
          .set({ personId: primaryId })
          .where(eq(memberships.id, m.id));
      }
    }

    // Cuenta de la app (login) ligada al duplicado, si la tuviera. Que las dos
    // tengan una ya se ha descartado antes de abrir la transacción.
    await tx
      .update(users)
      .set({ personId: primaryId })
      .where(eq(users.personId, duplicateId));

    // Etiquetas: reasignar, salvo que la principal ya tuviera la misma
    // (índice único personId+tag).
    const dupTags = await tx.query.personTags.findMany({
      where: eq(personTags.personId, duplicateId),
    });
    for (const row of dupTags) {
      const clash = await tx.query.personTags.findFirst({
        where: and(eq(personTags.personId, primaryId), eq(personTags.tag, row.tag)),
      });
      if (clash) {
        await tx.delete(personTags).where(eq(personTags.id, row.id));
      } else {
        await tx.update(personTags).set({ personId: primaryId }).where(eq(personTags.id, row.id));
      }
    }

    // El resto de lo que cuelga del duplicado, sin restricción única de por
    // medio. Sin esto, el borrado final se lo lleva por delante: lo que es
    // `cascade` (notas, documentos, titulaciones, médico, lesiones) desaparece
    // en silencio, lo que es `restrict` (mandatos y cobros SEPA) hace fallar la
    // fusión entera, y lo que es `set null` (facturas emitidas, inscripciones
    // emparejadas, contacto de patrocinador) pierde el vínculo.
    await tx
      .update(personNotes)
      .set({ personId: primaryId })
      .where(eq(personNotes.personId, duplicateId));
    await tx
      .update(personDocuments)
      .set({ personId: primaryId })
      .where(eq(personDocuments.personId, duplicateId));
    await tx
      .update(personQualifications)
      .set({ personId: primaryId })
      .where(eq(personQualifications.personId, duplicateId));
    await tx
      .update(personMedicalCheckups)
      .set({ personId: primaryId })
      .where(eq(personMedicalCheckups.personId, duplicateId));
    await tx
      .update(personInjuryReports)
      .set({ personId: primaryId })
      .where(eq(personInjuryReports.personId, duplicateId));
    await tx
      .update(sepaMandates)
      .set({ payerPersonId: primaryId })
      .where(eq(sepaMandates.payerPersonId, duplicateId));
    await tx
      .update(sepaCharges)
      .set({ payerPersonId: primaryId })
      .where(eq(sepaCharges.payerPersonId, duplicateId));
    await tx
      .update(issuedInvoices)
      .set({ personId: primaryId })
      .where(eq(issuedInvoices.personId, duplicateId));
    await tx
      .update(registrations)
      .set({ matchedPersonId: primaryId })
      .where(eq(registrations.matchedPersonId, duplicateId));
    await tx
      .update(registrationGuardians)
      .set({ matchedPersonId: primaryId })
      .where(eq(registrationGuardians.matchedPersonId, duplicateId));
    await tx
      .update(sponsors)
      .set({ contactPersonId: primaryId })
      .where(eq(sponsors.contactPersonId, duplicateId));

    // Terceros que pagaban a través del duplicado pasan a pagar a través de la
    // principal; el `ne` evita dejarla pagándose a sí misma.
    await tx
      .update(persons)
      .set({ payerPersonId: primaryId })
      .where(and(eq(persons.payerPersonId, duplicateId), ne(persons.id, primaryId)));

    await tx.delete(persons).where(eq(persons.id, duplicateId));
  });

  if (orphanedPhotoPath) {
    const supabase = await createClient();
    await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([orphanedPhotoPath, personPhotoThumbPath(orphanedPhotoPath)]);
  }

  updateTag(DUPLICATE_PERSONS_TAG);
  updateTag(INTEGRITY_ISSUES_TAG);
  revalidateRoutes(
    ROUTE.personas,
    ROUTE.personaFicha,
    ROUTE.personasDuplicados,
    ROUTE.socios,
    ROUTE.medico,
    ROUTE.equipos,
    ROUTE.cuotas,
  );
  return { message: t("mergeSuccess") };
}
