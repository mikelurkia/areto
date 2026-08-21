import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { memberships, registrations, teams } from "@/db/schema";
import { isMinor } from "@/lib/age";
import { findCandidates, type PersonForMatching } from "@/lib/person-matching";

/** Etiqueta de caché de las renovaciones de temporada; la invalidan las
 * acciones que aprueban/rechazan inscripciones o tocan la plantilla. */
export const SEASON_RENEWALS_TAG = "season-renewals";

export type RenewalStatus = "approved" | "pending" | "rejected" | "missing";

/** Roles de plantilla que cuentan como alta de equipo a efectos de inscripción
 * web (excluye patrocinadores u otras relaciones sin membership). */
const ROSTER_ROLES = ["player", "coach", "staff"] as const;

type RegistrationForMatching = PersonForMatching & {
  status: "pending" | "approved" | "rejected";
  matchedPersonId: string | null;
};

export type SeasonRenewalRow = {
  personId: string;
  personName: string;
  teamId: string;
  teamName: string;
  status: RenewalStatus;
  registrationId: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
};

export type SeasonRenewals = {
  rows: SeasonRenewalRow[];
  missingCount: number;
  total: number;
};

/**
 * Estado de renovación de un jugador para la temporada de `seasonRegistrations`.
 * Prioridad: aprobada por enlace directo (`matchedPersonId`) > coincidencia por
 * identidad (DNI/email/nombre, igual que en la revisión de inscripciones)
 * pendiente > rechazada > aprobada por identidad (caso raro) > sin ninguna.
 */
export function resolveRenewalStatus(
  person: PersonForMatching,
  seasonRegistrations: RegistrationForMatching[],
): { status: RenewalStatus; registrationId: string | null } {
  const approvedById = seasonRegistrations.find(
    (r) => r.status === "approved" && r.matchedPersonId === person.id,
  );
  if (approvedById) return { status: "approved", registrationId: approvedById.id };

  const candidates = findCandidates(person, seasonRegistrations);
  const pending = candidates.find((r) => r.status === "pending");
  if (pending) return { status: "pending", registrationId: pending.id };
  const rejected = candidates.find((r) => r.status === "rejected");
  if (rejected) return { status: "rejected", registrationId: rejected.id };
  const approvedByIdentity = candidates.find((r) => r.status === "approved");
  if (approvedByIdentity) return { status: "approved", registrationId: approvedByIdentity.id };

  return { status: "missing", registrationId: null };
}

/**
 * Cruza la plantilla de una temporada (jugadores y cuerpo técnico, vía
 * `memberships` de sus equipos, ya poblada normalmente al renovar/importar
 * equipos del año anterior) con las inscripciones enviadas esa misma
 * temporada, para saber quién todavía no ha confirmado la renovación y a
 * quién avisar.
 */
export async function loadSeasonRenewals(seasonId: string): Promise<SeasonRenewals> {
  "use cache";
  cacheTag(SEASON_RENEWALS_TAG);
  cacheLife("minutes");

  const seasonTeams = await db.query.teams.findMany({
    where: eq(teams.seasonId, seasonId),
    columns: { id: true, name: true },
  });
  const teamIds = seasonTeams.map((t) => t.id);
  if (teamIds.length === 0) return { rows: [], missingCount: 0, total: 0 };
  const teamNameById = new Map(seasonTeams.map((t) => [t.id, t.name]));

  const [seasonMemberships, seasonRegistrations] = await Promise.all([
    db.query.memberships.findMany({
      where: and(inArray(memberships.teamId, teamIds), inArray(memberships.role, ROSTER_ROLES)),
      with: {
        person: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            nationalId: true,
            email: true,
            phone: true,
            birthDate: true,
          },
          with: {
            guardianRows: {
              with: {
                guardian: {
                  columns: { firstName: true, lastName: true, phone: true, email: true },
                },
              },
            },
          },
        },
      },
    }),
    db.query.registrations.findMany({
      where: and(eq(registrations.seasonId, seasonId), eq(registrations.kind, "player")),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        nationalId: true,
        email: true,
        status: true,
        matchedPersonId: true,
      },
    }),
  ]);

  // Una persona puede estar en más de un equipo de la misma temporada (raro
  // pero posible) — nos quedamos con la primera membership para no duplicar filas.
  const seenPersonIds = new Set<string>();
  const rows: SeasonRenewalRow[] = [];

  for (const m of seasonMemberships) {
    if (seenPersonIds.has(m.personId)) continue;
    seenPersonIds.add(m.personId);

    const person = m.person;
    const { status, registrationId } = resolveRenewalStatus(person, seasonRegistrations);

    const primaryGuardian = isMinor(person.birthDate)
      ? person.guardianRows.find((r) => r.isPrimary)?.guardian ?? null
      : null;

    rows.push({
      personId: person.id,
      personName: `${person.firstName} ${person.lastName}`,
      teamId: m.teamId,
      teamName: teamNameById.get(m.teamId) ?? "",
      status,
      registrationId,
      contactName: primaryGuardian
        ? `${primaryGuardian.firstName} ${primaryGuardian.lastName}`
        : `${person.firstName} ${person.lastName}`,
      contactPhone: primaryGuardian?.phone ?? person.phone,
      contactEmail: primaryGuardian?.email ?? person.email,
    });
  }

  const missingCount = rows.filter((r) => r.status === "missing" || r.status === "rejected").length;

  return { rows, missingCount, total: rows.length };
}
