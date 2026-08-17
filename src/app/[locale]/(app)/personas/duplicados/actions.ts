"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { attendances, memberships, payments, persons, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MergeState = {
  error?: string;
  message?: string;
};

const MANAGE_ROLES = ["admin", "staff"] as const;
const PHOTO_BUCKET = "person-photos";

export async function mergePersons(
  _prev: MergeState,
  formData: FormData,
): Promise<MergeState> {
  const t = await getTranslations("Personas");
  await requireRole([...MANAGE_ROLES]);

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
        isMember: primary.isMember || duplicate.isMember,
        photoConsent: primary.photoConsent || duplicate.photoConsent,
      })
      .where(eq(persons.id, primaryId));

    // Personas cuyo tutor/a era el duplicado pasan a apuntar al principal
    // (evitando que el propio principal quede como su propio tutor).
    if (primary.guardianId === duplicateId) {
      await tx.update(persons).set({ guardianId: null }).where(eq(persons.id, primaryId));
    }
    await tx
      .update(persons)
      .set({ guardianId: primaryId })
      .where(and(eq(persons.guardianId, duplicateId), ne(persons.id, primaryId)));

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

    await tx.delete(persons).where(eq(persons.id, duplicateId));
  });

  if (orphanedPhotoPath) {
    const supabase = await createClient();
    await supabase.storage.from(PHOTO_BUCKET).remove([orphanedPhotoPath]);
  }

  revalidatePath("/", "layout");
  return { message: t("mergeSuccess") };
}
