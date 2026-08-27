import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { feePeriod, seasons, teams } from "@/db/schema";
import { TEAM_CATEGORIES, type TeamCategoryValue } from "@/components/equipos/team-categories";

export type RegistrationAvailability = {
  seasonId: string | null;
  seasonName: string | null;
  teamRegistrationOpen: boolean;
  memberOpen: boolean;
  memberAnnualFeeCents: number;
};

/** Etiqueta de caché de la disponibilidad de inscripción; la invalidan las acciones de club y de temporada. */
export const REGISTRATION_AVAILABILITY_TAG = "registration-availability";

/**
 * Único punto de verdad sobre si los formularios públicos de inscripción
 * aceptan envíos ahora mismo. El interruptor abierto/cerrado es global (dato
 * del club, no de cada temporada: solo hay una temporada activa a la vez).
 * Sin temporada actual no hay dónde colgar la inscripción, así que ambos
 * están cerrados aunque el interruptor esté activado.
 *
 * Cacheada con `use cache` (mismo patrón que `getClubSettings`): no depende
 * del usuario ni de la petición, y la piden las páginas públicas de
 * inscripción, que así pueden formar parte del armazón estático en vez de
 * bloquear el render. Las acciones de club y de temporada la invalidan por etiqueta.
 */
export async function getRegistrationAvailability(): Promise<RegistrationAvailability> {
  "use cache";
  cacheTag(REGISTRATION_AVAILABILITY_TAG);
  cacheLife("max");

  const [settings, season] = await Promise.all([
    db.query.clubSettings.findFirst({
      columns: {
        playerRegistrationOpen: true,
        memberRegistrationOpen: true,
        memberAnnualFeeCents: true,
      },
    }),
    db.query.seasons.findFirst({
      where: eq(seasons.isCurrent, true),
      columns: { id: true, name: true },
    }),
  ]);

  return {
    seasonId: season?.id ?? null,
    seasonName: season?.name ?? null,
    teamRegistrationOpen: Boolean(season) && (settings?.playerRegistrationOpen ?? false),
    memberOpen: Boolean(season) && (settings?.memberRegistrationOpen ?? false),
    memberAnnualFeeCents: settings?.memberAnnualFeeCents ?? 2000,
  };
}

/** Etiqueta de caché de la tabla pública de cuotas; la invalidan las acciones de equipo. */
export const SEASON_FEES_TAG = "season-fees";

export type SeasonFeeRow = {
  /** Categoría del enum `team_category`, o null para los equipos sin categoría. */
  category: TeamCategoryValue | null;
  period: (typeof feePeriod.enumValues)[number];
  minCents: number;
  /** Igual a `minCents` salvo que dos equipos de la misma categoría cobren distinto. */
  maxCents: number;
};

/**
 * Cuotas de la temporada actual agrupadas por categoría, para enseñárselas a
 * quien se inscribe por la web.
 *
 * Al inscribirse todavía no hay equipo asignado (`registrations` no tiene
 * `teamId`: el equipo se elige al aprobar la solicitud), así que lo más
 * concreto que podemos decir con verdad es el importe de la categoría. Si dos
 * equipos de la misma categoría cobran distinto, sale el rango.
 *
 * Cacheada con `use cache` por lo mismo que `getRegistrationAvailability`: no
 * depende del usuario ni de la petición, la pide una página pública que así
 * sigue formando parte del armazón estático, y el dato se fija una vez por
 * temporada. Las acciones de equipo la invalidan por etiqueta.
 */
export async function getSeasonFeeTable(): Promise<SeasonFeeRow[]> {
  "use cache";
  cacheTag(SEASON_FEES_TAG);
  cacheLife("max");

  const season = await db.query.seasons.findFirst({
    where: eq(seasons.isCurrent, true),
    columns: { id: true },
  });
  if (!season) return [];

  const rows = await db.query.teams.findMany({
    where: and(eq(teams.seasonId, season.id), isNotNull(teams.playerFeeCents)),
    columns: { category: true, playerFeeCents: true, playerFeePeriod: true },
  });

  const byKey = new Map<string, SeasonFeeRow>();
  for (const row of rows) {
    const cents = row.playerFeeCents;
    if (cents === null) continue;
    const key = `${row.category ?? ""}:${row.playerFeePeriod}`;
    const current = byKey.get(key);
    if (current) {
      current.minCents = Math.min(current.minCents, cents);
      current.maxCents = Math.max(current.maxCents, cents);
    } else {
      byKey.set(key, {
        category: row.category,
        period: row.playerFeePeriod,
        minCents: cents,
        maxCents: cents,
      });
    }
  }

  // Orden de categoría (escuela → senior), con los equipos sin categoría al final.
  return [...byKey.values()].sort((a, b) => {
    const ia = a.category ? TEAM_CATEGORIES.indexOf(a.category) : TEAM_CATEGORIES.length;
    const ib = b.category ? TEAM_CATEGORIES.indexOf(b.category) : TEAM_CATEGORIES.length;
    return ia - ib || a.minCents - b.minCents;
  });
}
