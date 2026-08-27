"use server";

import { and, eq, inArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { memberships, seasons, teams } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { readAmountCents } from "@/lib/money";
import { SEASON_FEES_TAG } from "@/lib/registration-settings";
import { SEASON_RENEWALS_TAG } from "@/lib/season-renewals";
import { TEAM_CATEGORIES, type TeamCategoryValue } from "@/components/equipos/team-categories";
import { TEAM_GENDERS, type TeamGenderValue } from "@/components/equipos/team-genders";
import { FEE_PERIODS, type FeePeriodValue } from "@/components/equipos/fee-periods";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type TeamState = {
  error?: string;
  message?: string;
};

function readCategory(formData: FormData): TeamCategoryValue | null {
  const value = String(formData.get("category") ?? "");
  return (TEAM_CATEGORIES as readonly string[]).includes(value)
    ? (value as TeamCategoryValue)
    : null;
}

function readGender(formData: FormData): TeamGenderValue | null {
  const value = String(formData.get("gender") ?? "");
  return (TEAM_GENDERS as readonly string[]).includes(value)
    ? (value as TeamGenderValue)
    : null;
}

function readBirthYear(formData: FormData, field: string): number | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function readFeePeriod(formData: FormData): FeePeriodValue {
  const value = String(formData.get("playerFeePeriod") ?? "");
  return (FEE_PERIODS as readonly string[]).includes(value)
    ? (value as FeePeriodValue)
    : "season";
}

/**
 * Campos de la cuota del jugador, comunes a alta y edición. El importe se
 * teclea en euros y se guarda en céntimos; vacío significa "sin cuota
 * definida", así que solo es error un valor que no sea un número válido.
 */
function readPlayerFee(formData: FormData):
  | { ok: true; cents: number | null; period: FeePeriodValue; notes: string | null }
  | { ok: false } {
  const raw = String(formData.get("playerFee") ?? "").trim();
  const cents = readAmountCents(formData.get("playerFee"));
  if (raw && (cents === null || cents < 0)) return { ok: false };

  const notes = String(formData.get("playerFeeNotes") ?? "").trim();
  return {
    ok: true,
    cents,
    period: readFeePeriod(formData),
    notes: notes || null,
  };
}

export async function createTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requirePermission("equipos.manage");

  const name = String(formData.get("name") ?? "").trim();
  const category = readCategory(formData);
  const gender = readGender(formData);
  const seasonId = String(formData.get("seasonId") ?? "");
  const minBirthYear = readBirthYear(formData, "minBirthYear");
  const maxBirthYear = readBirthYear(formData, "maxBirthYear");
  const federationGroup = String(formData.get("federationGroup") ?? "").trim();
  const federationCode = String(formData.get("federationCode") ?? "").trim();
  const fee = readPlayerFee(formData);

  if (!name) return { error: t("nameRequired") };
  if (minBirthYear !== null && maxBirthYear !== null && minBirthYear > maxBirthYear) {
    return { error: t("birthYearRangeInvalid") };
  }
  if (!fee.ok) return { error: t("playerFeeInvalid") };

  await db.insert(teams).values({
    seasonId,
    name,
    category,
    gender,
    minBirthYear,
    maxBirthYear,
    federationGroup: federationGroup || null,
    federationCode: federationCode || null,
    playerFeeCents: fee.cents,
    playerFeePeriod: fee.period,
    playerFeeNotes: fee.notes,
  });

  updateTag(SEASON_FEES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(ROUTE.equipos, ROUTE.equipoFicha, ROUTE.dashboard);
  return { message: t("teamCreated") };
}

export async function updateTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requirePermission("equipos.manage");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = readCategory(formData);
  const gender = readGender(formData);
  const minBirthYear = readBirthYear(formData, "minBirthYear");
  const maxBirthYear = readBirthYear(formData, "maxBirthYear");
  const federationGroup = String(formData.get("federationGroup") ?? "").trim();
  const federationCode = String(formData.get("federationCode") ?? "").trim();
  const fee = readPlayerFee(formData);

  if (!name) return { error: t("nameRequired") };
  if (minBirthYear !== null && maxBirthYear !== null && minBirthYear > maxBirthYear) {
    return { error: t("birthYearRangeInvalid") };
  }
  if (!fee.ok) return { error: t("playerFeeInvalid") };

  await db
    .update(teams)
    .set({
      name,
      category,
      gender,
      minBirthYear,
      maxBirthYear,
      federationGroup: federationGroup || null,
      federationCode: federationCode || null,
      playerFeeCents: fee.cents,
      playerFeePeriod: fee.period,
      playerFeeNotes: fee.notes,
    })
    .where(eq(teams.id, id));

  updateTag(SEASON_FEES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(ROUTE.equipos, ROUTE.equipoFicha, ROUTE.dashboard);
  return { message: t("teamUpdated") };
}

export async function deleteTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requirePermission("equipos.manage");

  const id = String(formData.get("id") ?? "");

  await db.delete(teams).where(eq(teams.id, id));

  updateTag(SEASON_FEES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(ROUTE.equipos, ROUTE.equipoFicha, ROUTE.dashboard);
  return { message: t("teamDeleted") };
}

/**
 * Renueva un equipo a otra temporada: crea la fila de equipo en la temporada
 * destino (mismos datos de categoría/federación) y copia su plantilla
 * (persona, rol, dorsal, puestos, capitanía). Lo que es propio de la
 * temporada que termina (alta federativa) se reinicia, igual que si se
 * hubiera dado de alta a mano.
 */
export async function renewTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requirePermission("equipos.manage");

  const teamId = String(formData.get("teamId") ?? "");
  const targetSeasonId = String(formData.get("targetSeasonId") ?? "");
  if (!targetSeasonId) return { error: t("targetSeasonRequired") };

  const source = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!source) return { error: t("teamNotFound") };
  if (source.seasonId === targetSeasonId) return { error: t("renewSameSeasonError") };

  const targetSeason = await db.query.seasons.findFirst({
    where: eq(seasons.id, targetSeasonId),
  });
  if (!targetSeason) return { error: t("targetSeasonRequired") };

  const alreadyRenewed = await db.query.teams.findFirst({
    where: and(eq(teams.previousTeamId, teamId), eq(teams.seasonId, targetSeasonId)),
  });
  if (alreadyRenewed) return { error: t("teamAlreadyRenewed") };

  const sourceMemberships = await db.query.memberships.findMany({
    where: eq(memberships.teamId, teamId),
  });

  await db.transaction(async (tx) => {
    const [newTeam] = await tx
      .insert(teams)
      .values({
        seasonId: targetSeasonId,
        name: source.name,
        category: source.category,
        gender: source.gender,
        minBirthYear: source.minBirthYear,
        maxBirthYear: source.maxBirthYear,
        federationGroup: source.federationGroup,
        federationCode: source.federationCode,
        playerFeeCents: source.playerFeeCents,
        playerFeePeriod: source.playerFeePeriod,
        playerFeeNotes: source.playerFeeNotes,
        previousTeamId: source.id,
      })
      .returning({ id: teams.id });

    if (sourceMemberships.length > 0) {
      await tx.insert(memberships).values(
        sourceMemberships.map((m) => ({
          personId: m.personId,
          teamId: newTeam.id,
          role: m.role,
          jerseyNumber: m.jerseyNumber,
          positions: m.positions,
          isCaptain: m.isCaptain,
          position: m.position,
        })),
      );
    }
  });

  updateTag(SEASON_FEES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(ROUTE.equipos, ROUTE.equipoFicha, ROUTE.dashboard);
  return { message: t("teamRenewed", { season: targetSeason.name }) };
}

/**
 * Trae en lote equipos de otra temporada a la temporada destino: la versión
 * masiva de `renewTeam`, pensada para el arranque de temporada (la mayoría de
 * equipos son los del año anterior). Por cada equipo de origen seleccionado
 * crea su fila en la temporada destino (mismos datos de categoría/federación) y,
 * si se pide, copia la plantilla (persona, rol, dorsal, puestos, capitanía).
 * Idempotente: salta los equipos ya traídos a esta temporada
 * (`previousTeamId` apuntando al de origen).
 */
export async function importTeamsFromSeason(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Temporadas");
  await requirePermission("equipos.manage");

  const targetSeasonId = String(formData.get("targetSeasonId") ?? "");
  const sourceSeasonId = String(formData.get("sourceSeasonId") ?? "");
  const teamIds = formData.getAll("teamIds").map(String).filter(Boolean);
  const copyRoster = formData.get("copyRoster") === "on";

  if (!targetSeasonId || !sourceSeasonId) return { error: t("importSourceRequired") };
  if (sourceSeasonId === targetSeasonId) return { error: t("importSameSeason") };
  if (teamIds.length === 0) return { error: t("importNoTeamsSelected") };

  const targetSeason = await db.query.seasons.findFirst({
    where: eq(seasons.id, targetSeasonId),
  });
  if (!targetSeason) return { error: t("importSourceRequired") };

  // Equipos de origen realmente seleccionados (y que pertenecen a la temporada de origen).
  const sourceTeams = await db.query.teams.findMany({
    where: and(eq(teams.seasonId, sourceSeasonId), inArray(teams.id, teamIds)),
  });
  if (sourceTeams.length === 0) return { error: t("importNoTeamsSelected") };

  // Idempotencia: saltar los que ya se trajeron a esta temporada.
  const alreadyImported = await db.query.teams.findMany({
    where: and(
      eq(teams.seasonId, targetSeasonId),
      inArray(
        teams.previousTeamId,
        sourceTeams.map((s) => s.id),
      ),
    ),
    columns: { previousTeamId: true },
  });
  const importedFrom = new Set(alreadyImported.map((row) => row.previousTeamId));
  const toImport = sourceTeams.filter((s) => !importedFrom.has(s.id));

  if (toImport.length === 0) return { error: t("importAllExist") };

  await db.transaction(async (tx) => {
    // Una sola query para las membresías de todos los equipos a importar, en
    // vez de una por equipo dentro del bucle (N+1).
    const allSourceMemberships = copyRoster
      ? await tx.query.memberships.findMany({
          where: inArray(
            memberships.teamId,
            toImport.map((s) => s.id),
          ),
        })
      : [];
    const membershipsByTeamId = new Map<string, (typeof allSourceMemberships)[number][]>();
    for (const m of allSourceMemberships) {
      const group = membershipsByTeamId.get(m.teamId);
      if (group) group.push(m);
      else membershipsByTeamId.set(m.teamId, [m]);
    }

    for (const source of toImport) {
      const [newTeam] = await tx
        .insert(teams)
        .values({
          seasonId: targetSeasonId,
          name: source.name,
          category: source.category,
          gender: source.gender,
          minBirthYear: source.minBirthYear,
          maxBirthYear: source.maxBirthYear,
          federationGroup: source.federationGroup,
          federationCode: source.federationCode,
          playerFeeCents: source.playerFeeCents,
          playerFeePeriod: source.playerFeePeriod,
          playerFeeNotes: source.playerFeeNotes,
          previousTeamId: source.id,
        })
        .returning({ id: teams.id });

      if (!copyRoster) continue;

      const sourceMemberships = membershipsByTeamId.get(source.id) ?? [];
      if (sourceMemberships.length > 0) {
        await tx.insert(memberships).values(
          sourceMemberships.map((m) => ({
            personId: m.personId,
            teamId: newTeam.id,
            role: m.role,
            jerseyNumber: m.jerseyNumber,
            positions: m.positions,
            isCaptain: m.isCaptain,
            position: m.position,
          })),
        );
      }
    }
  });

  updateTag(SEASON_FEES_TAG);
  updateTag(SEASON_RENEWALS_TAG);
  revalidateRoutes(ROUTE.equipos, ROUTE.equipoFicha, ROUTE.dashboard);
  return { message: t("teamsImported", { count: toImport.length }) };
}
