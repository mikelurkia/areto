"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { courtEvents } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { assertCourtEventAccess } from "@/lib/court-events";
import { PREFERRED_DAYS, type PreferredDayValue } from "@/components/calendario/preferred-days";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type CourtEventState = {
  error?: string;
  message?: string;
};

function readPreferredDay(formData: FormData): PreferredDayValue | null {
  const value = String(formData.get("preferredDay") ?? "");
  return (PREFERRED_DAYS as readonly string[]).includes(value)
    ? (value as PreferredDayValue)
    : null;
}

function readIsHome(formData: FormData): boolean | null {
  const value = formData.get("isHome");
  if (value === "home") return true;
  if (value === "away") return false;
  return null;
}

function readCourtEventFields(formData: FormData) {
  return {
    teamId: String(formData.get("teamId") ?? "").trim(),
    weekendOf: String(formData.get("weekendOf") ?? "").trim(),
    isHome: readIsHome(formData),
    opponent: String(formData.get("opponent") ?? "").trim(),
    preferredDay: readPreferredDay(formData),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createCourtEvent(
  _prev: CourtEventState,
  formData: FormData,
): Promise<CourtEventState> {
  const t = await getTranslations("Calendario");
  const user = await requirePermission("calendario.manage");

  const fields = readCourtEventFields(formData);
  if (!fields.teamId) return { error: t("teamRequired") };
  if (!fields.weekendOf) return { error: t("weekendRequired") };
  if (fields.isHome === null) return { error: t("homeAwayRequired") };
  if (!(await assertCourtEventAccess(user, fields.teamId))) return { error: t("notAllowed") };

  await db.insert(courtEvents).values({
    kind: "match",
    teamId: fields.teamId,
    weekendOf: fields.weekendOf,
    isHome: fields.isHome,
    opponent: fields.opponent || null,
    preferredDay: fields.preferredDay,
    notes: fields.notes || null,
    createdByUserId: user.id,
  });

  revalidateRoutes(ROUTE.calendario, ROUTE.dashboard);
  return { message: t("matchCreated") };
}

export async function updateCourtEvent(
  _prev: CourtEventState,
  formData: FormData,
): Promise<CourtEventState> {
  const t = await getTranslations("Calendario");
  const user = await requirePermission("calendario.manage");

  const id = String(formData.get("id") ?? "");
  const fields = readCourtEventFields(formData);
  if (!fields.teamId) return { error: t("teamRequired") };
  if (!fields.weekendOf) return { error: t("weekendRequired") };
  if (fields.isHome === null) return { error: t("homeAwayRequired") };

  const existing = await db.query.courtEvents.findFirst({
    where: eq(courtEvents.id, id),
    columns: { teamId: true },
  });
  if (!existing) return { error: t("notAllowed") };
  // Se comprueba tanto el equipo de origen como el de destino: un entrenador
  // no puede ni editar un partido ajeno ni "trasladarlo" a su propio equipo.
  if (!(await assertCourtEventAccess(user, existing.teamId))) return { error: t("notAllowed") };
  if (!(await assertCourtEventAccess(user, fields.teamId))) return { error: t("notAllowed") };

  await db
    .update(courtEvents)
    .set({
      teamId: fields.teamId,
      weekendOf: fields.weekendOf,
      isHome: fields.isHome,
      opponent: fields.opponent || null,
      preferredDay: fields.preferredDay,
      notes: fields.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(courtEvents.id, id));

  revalidateRoutes(ROUTE.calendario, ROUTE.dashboard);
  return { message: t("matchUpdated") };
}

export async function deleteCourtEvent(
  _prev: CourtEventState,
  formData: FormData,
): Promise<CourtEventState> {
  const t = await getTranslations("Calendario");
  const user = await requirePermission("calendario.manage");

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.courtEvents.findFirst({
    where: eq(courtEvents.id, id),
    columns: { teamId: true },
  });
  if (!existing) return { error: t("notAllowed") };
  if (!(await assertCourtEventAccess(user, existing.teamId))) return { error: t("notAllowed") };

  await db.delete(courtEvents).where(eq(courtEvents.id, id));

  revalidateRoutes(ROUTE.calendario, ROUTE.dashboard);
  return { message: t("matchDeleted") };
}
