import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { memberships, persons, registrations } from "@/db/schema";
import { findDuplicatePersonGroups } from "@/lib/person-matching";

/** Etiquetas de caché de las tarjetas de incoherencias del dashboard. */
export const INTEGRITY_ISSUES_TAG = "data-integrity-issues";
export const DUPLICATE_PERSONS_TAG = "duplicate-persons";

export type IntegritySeverity = "hard" | "soft";

export type IntegrityIssueKey =
  | "orphanPlayers"
  | "missingNationalId"
  | "medicalCertMismatch"
  | "duplicateCaptains"
  | "sponsorshipMismatch";

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
  const approvedPlayerRegistrations = await db.query.registrations.findMany({
    where: and(
      eq(registrations.kind, "player"),
      eq(registrations.status, "approved"),
      isNotNull(registrations.matchedPersonId),
    ),
    columns: { matchedPersonId: true },
  });
  const personIds = [
    ...new Set(approvedPlayerRegistrations.map((r) => r.matchedPersonId!)),
  ];
  if (personIds.length === 0) return 0;

  const matchedPersons = await db.query.persons.findMany({
    where: inArray(persons.id, personIds),
    columns: { id: true },
    with: { memberships: { columns: { id: true } } },
  });
  return matchedPersons.filter((p) => p.memberships.length === 0).length;
}

/**
 * Fichas activas (con membership en la temporada actual o alta de socio
 * vigente) sin DNI/NIE: el formulario de inscripción y la revisión nunca lo
 * exigen, solo validan el formato si se rellena.
 */
async function countMissingNationalId(): Promise<number> {
  const rows = await db.query.persons.findMany({
    where: isNull(persons.nationalId),
    columns: { id: true },
    with: {
      memberships: {
        columns: {},
        with: { team: { columns: {}, with: { season: { columns: { isCurrent: true } } } } },
      },
      clubMember: { columns: { status: true } },
    },
  });
  return rows.filter(
    (p) =>
      p.memberships.some((m) => m.team.season.isCurrent) || p.clubMember?.status === "active",
  ).length;
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

  const rows = await db.query.persons.findMany({
    columns: { id: true, medicalCertUntil: true },
    with: {
      medicalCheckups: { columns: { occurredOn: true, expiresOn: true } },
      memberships: {
        columns: { role: true },
        with: { team: { columns: { seasonId: true } } },
      },
    },
  });

  let count = 0;
  for (const person of rows) {
    const isActivePlayer = person.memberships.some(
      (m) => m.role === "player" && m.team.seasonId === currentSeasonId,
    );
    if (!isActivePlayer) continue;

    if (person.medicalCheckups.length === 0) {
      if (person.medicalCertUntil !== null) count++;
      continue;
    }
    const latest = person.medicalCheckups.reduce((a, b) =>
      a.occurredOn >= b.occurredOn ? a : b,
    );
    if (latest.expiresOn !== person.medicalCertUntil) count++;
  }
  return count;
}

/**
 * `memberships.isCaptain` debería ser único por equipo (lo garantiza
 * `updateTeamCaptain`, pero solo en código, sin índice único en BD). Cuenta
 * equipos de la temporada dada con más de un capitán marcado.
 */
async function countDuplicateCaptains(seasonId: string): Promise<number> {
  const rows = await db.query.memberships.findMany({
    where: eq(memberships.isCaptain, true),
    columns: { teamId: true },
    with: { team: { columns: { seasonId: true } } },
  });

  const countsByTeam = new Map<string, number>();
  for (const m of rows) {
    if (m.team.seasonId !== seasonId) continue;
    countsByTeam.set(m.teamId, (countsByTeam.get(m.teamId) ?? 0) + 1);
  }
  return [...countsByTeam.values()].filter((c) => c > 1).length;
}

/**
 * Un acuerdo de patrocinio tiene un problema si dos anualidades comparten el
 * mismo año (nada lo impide al añadir un cobro manual con `addSponsorPayment`)
 * o si la suma de sus anualidades ya no cuadra con el importe total pactado
 * (`sponsorshipTerms.totalAmountCents`) una vez el acuerdo ha dejado de estar
 * en negociación.
 */
async function countSponsorshipMismatches(): Promise<number> {
  const terms = await db.query.sponsorshipTerms.findMany({
    columns: { id: true, totalAmountCents: true, agreementStatus: true },
    with: { payments: { columns: { year: true, amountCents: true } } },
  });

  let count = 0;
  for (const term of terms) {
    const countsByYear = new Map<number, number>();
    for (const payment of term.payments) {
      if (payment.year === null) continue;
      countsByYear.set(payment.year, (countsByYear.get(payment.year) ?? 0) + 1);
    }
    const hasDuplicateYear = [...countsByYear.values()].some((c) => c > 1);

    const paidTotal = term.payments.reduce((sum, p) => sum + p.amountCents, 0);
    const sumMismatch =
      term.agreementStatus !== "negotiating" &&
      term.totalAmountCents !== null &&
      paidTotal !== term.totalAmountCents;

    if (hasDuplicateYear || sumMismatch) count++;
  }
  return count;
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
  cacheLife("minutes");

  const [orphanPlayers, missingNationalId, medicalCertMismatch, duplicateCaptains, sponsorshipMismatch] =
    await Promise.all([
      countOrphanPlayers(),
      countMissingNationalId(),
      countMedicalCertMismatches(currentSeasonId),
      currentSeasonId ? countDuplicateCaptains(currentSeasonId) : Promise.resolve(0),
      countSponsorshipMismatches(),
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
    {
      key: "sponsorshipMismatch",
      count: sponsorshipMismatch,
      severity: "hard",
      href: "/patrocinadores",
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
  cacheLife("minutes");

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
