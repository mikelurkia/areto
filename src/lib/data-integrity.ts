import "server-only";

import {
  and,
  count,
  countDistinct,
  eq,
  exists,
  gt,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import {
  clubMembers,
  memberships,
  personMedicalCheckups,
  persons,
  registrations,
  seasons,
  teams,
} from "@/db/schema";

/**
 * Cada chequeo devuelve un número, así que se cuenta en SQL y no en memoria:
 * antes varios de ellos se traían la tabla `persons` entera —con relaciones
 * anidadas— para filtrarla en JavaScript, y el coste escalaba con el tamaño
 * del club en vez de con el subconjunto que interesa.
 */
async function scalarCount(query: { execute: () => Promise<{ value: number }[]> }) {
  const [row] = await query.execute();
  return Number(row?.value ?? 0);
}
import { findDuplicatePersonGroups } from "@/lib/person-matching";

/** Etiquetas de caché de las tarjetas de incoherencias del dashboard. */
export const INTEGRITY_ISSUES_TAG = "data-integrity-issues";
export const DUPLICATE_PERSONS_TAG = "duplicate-persons";

export type IntegritySeverity = "hard" | "soft";

export type IntegrityIssueKey =
  | "orphanPlayers"
  | "missingNationalId"
  | "medicalCertMismatch"
  | "duplicateCaptains";

export type IntegrityIssue = {
  key: IntegrityIssueKey;
  count: number;
  severity: IntegritySeverity;
  href: string;
};

/**
 * Jugadores aprobados desde una inscripción web (`registrations.kind =
 * "player"`) sin ninguna `membership`: pasa cuando se aprueba sin elegir
 * equipo (ver `approveRegistration` en inscripciones/actions.ts), que solo
 * crea la ficha de `persons` pero ninguna plantilla.
 */
async function countOrphanPlayers(): Promise<number> {
  // `countDistinct`: dos inscripciones aprobadas de la misma persona son una
  // sola ficha huérfana.
  return scalarCount(
    db
      .select({ value: countDistinct(registrations.matchedPersonId) })
      .from(registrations)
      .where(
        and(
          eq(registrations.kind, "player"),
          eq(registrations.status, "approved"),
          isNotNull(registrations.matchedPersonId),
          notExists(
            db
              .select({ one: sql`1` })
              .from(memberships)
              .where(eq(memberships.personId, registrations.matchedPersonId)),
          ),
        ),
      ),
  );
}

/**
 * Fichas activas (con membership en la temporada actual o alta de socio
 * vigente) sin DNI/NIE: el formulario de inscripción y la revisión nunca lo
 * exigen, solo validan el formato si se rellena.
 */
async function countMissingNationalId(): Promise<number> {
  return scalarCount(
    db
      .select({ value: count() })
      .from(persons)
      .where(
        and(
          isNull(persons.nationalId),
          or(
            exists(
              db
                .select({ one: sql`1` })
                .from(memberships)
                .innerJoin(teams, eq(teams.id, memberships.teamId))
                .innerJoin(seasons, eq(seasons.id, teams.seasonId))
                .where(
                  and(eq(memberships.personId, persons.id), eq(seasons.isCurrent, true)),
                ),
            ),
            exists(
              db
                .select({ one: sql`1` })
                .from(clubMembers)
                .where(
                  and(eq(clubMembers.personId, persons.id), eq(clubMembers.status, "active")),
                ),
            ),
          ),
        ),
      ),
  );
}

/**
 * `persons.medicalCertUntil` debería ser siempre el `expiresOn` del
 * reconocimiento médico de `occurredOn` más reciente (lo mantiene
 * `recomputeMedicalCertUntil` en personas/actions.ts al crear/editar/borrar un
 * reconocimiento). Si no coincide, alguna edición se ha saltado ese cálculo.
 * Solo interesa para jugadores con ficha en un equipo de la temporada activa:
 * a nadie más (staff, socios, tutores...) se le exige certificado médico.
 */
async function countMedicalCertMismatches(currentSeasonId: string | null): Promise<number> {
  if (!currentSeasonId) return 0;

  /**
   * El `expiresOn` del reconocimiento más reciente, o `NULL` si la persona no
   * tiene ninguno. `IS DISTINCT FROM` cubre de una vez los dos casos que antes
   * eran dos ramas del bucle: fechas que no cuadran, y ficha con
   * `medicalCertUntil` puesto sin ningún reconocimiento detrás.
   */
  const latestExpiresOn = sql`(
    SELECT ${personMedicalCheckups.expiresOn}
    FROM ${personMedicalCheckups}
    WHERE ${eq(personMedicalCheckups.personId, persons.id)}
    ORDER BY ${personMedicalCheckups.occurredOn} DESC
    LIMIT 1
  )`;

  return scalarCount(
    db
      .select({ value: count() })
      .from(persons)
      .where(
        and(
          exists(
            db
              .select({ one: sql`1` })
              .from(memberships)
              .innerJoin(teams, eq(teams.id, memberships.teamId))
              .where(
                and(
                  eq(memberships.personId, persons.id),
                  eq(memberships.role, "player"),
                  eq(teams.seasonId, currentSeasonId),
                ),
              ),
          ),
          sql`${latestExpiresOn} IS DISTINCT FROM ${persons.medicalCertUntil}`,
        ),
      ),
  );
}

/**
 * `memberships.isCaptain` debería ser único por equipo (lo garantiza
 * `updateTeamCaptain`, pero solo en código, sin índice único en BD). Cuenta
 * equipos de la temporada dada con más de un capitán marcado.
 */
async function countDuplicateCaptains(seasonId: string): Promise<number> {
  const perTeam = db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(and(eq(memberships.isCaptain, true), eq(teams.seasonId, seasonId)))
    .groupBy(memberships.teamId)
    .having(gt(count(), 1))
    .as("teams_con_varios_capitanes");

  return scalarCount(db.select({ value: count() }).from(perTeam));
}

/**
 * Incoherencias de datos que no están forzadas a nivel de base de datos:
 * cada chequeo detecta una regla de negocio que solo se rompe editando a
 * mano, con un bug puntual, o saltándose un paso del flujo normal. Solo
 * devuelve los casos con al menos una incidencia.
 */
export async function loadDataIntegrityIssues(
  currentSeasonId: string | null,
): Promise<IntegrityIssue[]> {
  "use cache";
  cacheTag(INTEGRITY_ISSUES_TAG);
  cacheLife("derivados");

  const [orphanPlayers, missingNationalId, medicalCertMismatch, duplicateCaptains] =
    await Promise.all([
      countOrphanPlayers(),
      countMissingNationalId(),
      countMedicalCertMismatches(currentSeasonId),
      currentSeasonId ? countDuplicateCaptains(currentSeasonId) : Promise.resolve(0),
    ]);

  const issues: IntegrityIssue[] = [
    { key: "orphanPlayers", count: orphanPlayers, severity: "hard", href: "/personas" },
    { key: "missingNationalId", count: missingNationalId, severity: "soft", href: "/personas" },
    {
      key: "medicalCertMismatch",
      count: medicalCertMismatch,
      severity: "hard",
      href: "/personas",
    },
    {
      key: "duplicateCaptains",
      count: duplicateCaptains,
      severity: "hard",
      href: "/equipos",
    },
  ];

  return issues.filter((issue) => issue.count > 0);
}

/**
 * Recuento de posibles duplicados de personas para la tarjeta de
 * incoherencias del dashboard (el detalle completo, con las herramientas de
 * fusión, vive en `/personas/duplicados`).
 */
export async function countDuplicatePersonGroups(): Promise<number> {
  "use cache";
  cacheTag(DUPLICATE_PERSONS_TAG);
  cacheLife("derivados");

  const allPersons = await db.query.persons.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      email: true,
      phone: true,
      iban: true,
    },
  });
  return findDuplicatePersonGroups(allPersons).length;
}
