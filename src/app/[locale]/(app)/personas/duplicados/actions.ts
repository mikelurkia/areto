"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  attendances,
  clubMembers,
  memberships,
  payments,
  personDocuments,
  personGuardians,
  personNotes,
  personQualifications,
  personTags,
  persons,
  users,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { DUPLICATE_PERSONS_TAG, INTEGRITY_ISSUES_TAG } from "@/lib/data-integrity";
import { personPhotoThumbPath } from "@/lib/person-photo";
import { createClient } from "@/lib/supabase/server";

export type MergeState = {
  error?: string;
  message?: string;
};

const PHOTO_BUCKET = "person-photos";

export async function mergePersons(
  _prev: MergeState,
  formData: FormData,
): Promise<MergeState> {
  const t = await getTranslations("Personas");
  await requirePermission("personas.manage");

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

  let orphanedPhotoPath: string | null = null;
  if (primary.photoPath && duplicate.photoPath) {
    orphanedPhotoPath = duplicate.photoPath;
  }

  await db.transaction(async (tx) => {
    // `email` y `nationalId` son únicos: si el duplicado tiene un valor que el
    // principal no tiene, hay que liberarlo del duplicado ANTES de copiarlo al
    // principal, porque el índice único se comprueba al ejecutar cada UPDATE,
    // no al final de la transacción — con las dos filas vivas a la vez, copiar
    // el valor al principal mientras el duplicado todavía lo tiene rompe el
    // índice aunque el duplicado se vaya a borrar dos pasos después.
    if (duplicate.email && !primary.email) {
      await tx.update(persons).set({ email: null }).where(eq(persons.id, duplicateId));
    }
    if (duplicate.nationalId && !primary.nationalId) {
      await tx.update(persons).set({ nationalId: null }).where(eq(persons.id, duplicateId));
    }

    await tx
      .update(persons)
      .set({
        email: primary.email ?? duplicate.email,
        phone: primary.phone ?? duplicate.phone,
        birthDate: primary.birthDate ?? duplicate.birthDate,
        nationalId: primary.nationalId ?? duplicate.nationalId,
        address: primary.address ?? duplicate.address,
        city: primary.city ?? duplicate.city,
        iban: primary.iban ?? duplicate.iban,
        medicalCertUntil: primary.medicalCertUntil ?? duplicate.medicalCertUntil,
        shirtSize: primary.shirtSize ?? duplicate.shirtSize,
        pantsSize: primary.pantsSize ?? duplicate.pantsSize,
        shoeSize: primary.shoeSize ?? duplicate.shoeSize,
        photoPath: primary.photoPath ?? duplicate.photoPath,
        notes: [primary.notes, duplicate.notes].filter(Boolean).join(" · ") || null,
        photoConsent: primary.photoConsent || duplicate.photoConsent,
        sepaConsent: primary.sepaConsent || duplicate.sepaConsent,
      })
      .where(eq(persons.id, primaryId));

    // Condición de socio: si ambas tenían fila, gana la del principal (mismo
    // criterio "primary wins" que el resto de campos); si solo la tenía el
    // duplicado, se reasigna en vez de perderla.
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

    // Tutores del duplicado (como tutelado): pasan al principal, salvo que ya
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
        // El duplicado tenía como tutor al propio principal: no tiene sentido tras la fusión.
        await tx.delete(personGuardians).where(eq(personGuardians.id, row.id));
      }
    }

    // Filas donde el duplicado era tutor de alguien: pasan al principal.
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
    // en el principal, descartar la del duplicado en vez de chocar con el índice único.
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

    await tx
      .update(payments)
      .set({ personId: primaryId })
      .where(eq(payments.personId, duplicateId));

    // Asistencias: mismo criterio que las fichas de equipo (índice único por evento+persona).
    const dupAttendances = await tx.query.attendances.findMany({
      where: eq(attendances.personId, duplicateId),
    });
    for (const a of dupAttendances) {
      const clash = await tx.query.attendances.findFirst({
        where: and(
          eq(attendances.personId, primaryId),
          eq(attendances.eventId, a.eventId),
        ),
      });
      if (clash) {
        await tx.delete(attendances).where(eq(attendances.id, a.id));
      } else {
        await tx
          .update(attendances)
          .set({ personId: primaryId })
          .where(eq(attendances.id, a.id));
      }
    }

    // Cuenta de la app (login) ligada al duplicado, si la tuviera.
    await tx
      .update(users)
      .set({ personId: primaryId })
      .where(eq(users.personId, duplicateId));

    // Etiquetas: reasignar, salvo que el principal ya tuviera la misma
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

    // Notas, documentos y titulaciones: sin restricción única, se reasignan
    // sin más para no perderlas al borrar el duplicado.
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
  revalidatePath("/", "layout");
  return { message: t("mergeSuccess") };
}
