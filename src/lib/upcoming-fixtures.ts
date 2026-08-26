import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { courtEvents, seasons, teams } from "@/db/schema";
import { groupCourtEventsByWeekend } from "@/lib/court-events";
import { TEAM_CATEGORIES, type TeamCategoryValue } from "@/components/equipos/team-categories";

/**
 * Cuánto se mira hacia delante para dar por "programado" el próximo partido de
 * un equipo. Más allá de este horizonte el equipo aparece como sin partido: en
 * la práctica el calendario federado nunca va tan por delante.
 */
export const FIXTURE_HORIZON_DAYS = 120;

export type UpcomingFixture = {
  weekendOf: string;
  opponent: string | null;
  isHome: boolean | null;
  preferredDay: "saturday" | "sunday" | "either" | null;
};

export type TeamFixture = {
  teamId: string;
  teamName: string;
  category: TeamCategoryValue | null;
  fixture: UpcomingFixture | null;
};

export type UpcomingFixtures = {
  /** Equipos de la temporada actual con su próximo partido (o `null`), ya
   * agrupados por categoría en el orden de `TEAM_CATEGORIES`. */
  byCategory: { category: TeamCategoryValue | null; teams: TeamFixture[] }[];
  /** Partidos en casa de la jornada más próxima sin día preferente acordado:
   * hay que avisar con antelación al polideportivo. */
  nextWeekendMissingPreferredDay: number;
};

function categoryRank(category: TeamCategoryValue | null): number {
  // Los equipos sin categoría van al final, no mezclados con escuela.
  return category === null ? TEAM_CATEGORIES.length : TEAM_CATEGORIES.indexOf(category);
}

/**
 * Próximo partido de cada equipo de la temporada actual, para el cuadro
 * deportivo del panel. Una sola lectura de `courtEvents` acotada al horizonte
 * (apoyada en `court_events_weekend_idx`) sirve para las dos cosas que necesita
 * el panel: el partido de cada equipo y el aviso de días sin confirmar de la
 * jornada más próxima.
 */
export async function loadUpcomingFixtures(
  today: string,
  horizonDays: number = FIXTURE_HORIZON_DAYS,
): Promise<UpcomingFixtures> {
  const horizonDate = new Date(`${today}T00:00:00`);
  horizonDate.setDate(horizonDate.getDate() + horizonDays);
  const horizon = horizonDate.toISOString().slice(0, 10);

  const currentSeason = await db.query.seasons.findFirst({
    where: eq(seasons.isCurrent, true),
    columns: { id: true },
  });
  if (!currentSeason) return { byCategory: [], nextWeekendMissingPreferredDay: 0 };

  const [seasonTeams, events] = await Promise.all([
    db.query.teams.findMany({
      where: eq(teams.seasonId, currentSeason.id),
      columns: { id: true, name: true, category: true },
    }),
    db.query.courtEvents.findMany({
      where: and(
        eq(courtEvents.kind, "match"),
        gte(courtEvents.weekendOf, today),
        lte(courtEvents.weekendOf, horizon),
      ),
      columns: {
        teamId: true,
        weekendOf: true,
        opponent: true,
        isHome: true,
        preferredDay: true,
      },
      orderBy: (ce, { asc }) => [asc(ce.weekendOf)],
    }),
  ]);

  // Los eventos vienen ordenados por fin de semana, así que el primero de cada
  // equipo es su próximo partido.
  const firstByTeam = new Map<string, UpcomingFixture>();
  for (const event of events) {
    if (!event.teamId || firstByTeam.has(event.teamId)) continue;
    firstByTeam.set(event.teamId, event);
  }

  const rows: TeamFixture[] = seasonTeams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    category: team.category,
    fixture: firstByTeam.get(team.id) ?? null,
  }));

  const byCategory: UpcomingFixtures["byCategory"] = [];
  for (const row of [...rows].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category) || a.teamName.localeCompare(b.teamName),
  )) {
    const last = byCategory.at(-1);
    if (last && last.category === row.category) last.teams.push(row);
    else byCategory.push({ category: row.category, teams: [row] });
  }

  const homeMatches = events.filter((e) => e.isHome === true);
  const weekendGroups = groupCourtEventsByWeekend(homeMatches);
  const nextWeekendKey = [...weekendGroups.keys()].sort()[0];
  const nextWeekendMissingPreferredDay = nextWeekendKey
    ? weekendGroups.get(nextWeekendKey)!.filter((m) => m.preferredDay === null).length
    : 0;

  return { byCategory, nextWeekendMissingPreferredDay };
}
