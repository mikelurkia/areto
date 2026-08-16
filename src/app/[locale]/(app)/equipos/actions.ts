"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { memberships, seasons, teams } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { TEAM_CATEGORIES, type TeamCategoryValue } from "@/components/equipos/team-categories";
import { TEAM_GENDERS, type TeamGenderValue } from "@/components/equipos/team-genders";

export type TeamState = {
  error?: string;
  message?: string;
};

const MANAGE_ROLES = ["admin", "staff"] as const;

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

export async function createTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const name = String(formData.get("name") ?? "").trim();
  const category = readCategory(formData);
  const gender = readGender(formData);
  const seasonId = String(formData.get("seasonId") ?? "");
  const minBirthYear = readBirthYear(formData, "minBirthYear");
  const maxBirthYear = readBirthYear(formData, "maxBirthYear");
  const federationGroup = String(formData.get("federationGroup") ?? "").trim();
  const federationCode = String(formData.get("federationCode") ?? "").trim();

  if (!name) return { error: t("nameRequired") };
  if (minBirthYear !== null && maxBirthYear !== null && minBirthYear > maxBirthYear) {
    return { error: t("birthYearRangeInvalid") };
  }

  await db.insert(teams).values({
    seasonId,
    name,
    category,
    gender,
    minBirthYear,
    maxBirthYear,
    federationGroup: federationGroup || null,
    federationCode: federationCode || null,
  });

  revalidatePath("/", "layout");
  return { message: t("teamCreated") };
}

export async function updateTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = readCategory(formData);
  const gender = readGender(formData);
  const minBirthYear = readBirthYear(formData, "minBirthYear");
  const maxBirthYear = readBirthYear(formData, "maxBirthYear");
  const federationGroup = String(formData.get("federationGroup") ?? "").trim();
  const federationCode = String(formData.get("federationCode") ?? "").trim();

  if (!name) return { error: t("nameRequired") };
  if (minBirthYear !== null && maxBirthYear !== null && minBirthYear > maxBirthYear) {
    return { error: t("birthYearRangeInvalid") };
  }

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
    })
    .where(eq(teams.id, id));

  revalidatePath("/", "layout");
  return { message: t("teamUpdated") };
}

export async function deleteTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

  const id = String(formData.get("id") ?? "");

  await db.delete(teams).where(eq(teams.id, id));

  revalidatePath("/", "layout");
  return { message: t("teamDeleted") };
}

/**
 * Renueva un equipo a otra temporada: crea la fila de equipo en la temporada
 * destino (mismos datos de categoría/federación) y copia su plantilla activa
 * (persona, rol, dorsal, puestos, capitanía). Lo que es propio de la
 * temporada que termina (equipación entregada, alta federativa) se reinicia,
 * igual que si se hubiera dado de alta a mano. No copia inactivos ni bajas.
 */
export async function renewTeam(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const t = await getTranslations("Equipos");
  await requireRole([...MANAGE_ROLES]);

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
    where: and(eq(memberships.teamId, teamId), eq(memberships.active, true)),
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

  revalidatePath("/", "layout");
  return { message: t("teamRenewed", { season: targetSeason.name }) };
}
