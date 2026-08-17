import { calculateAge } from "@/lib/age";

/**
 * Cálculo de "salud de plantilla" compartido entre el detalle del equipo y el
 * listado. Puro (sin React), para poder usarlo en cualquier componente de
 * servidor.
 */
type HealthMembership = {
  role: string;
  jerseyNumber: number | null;
  positions: string[];
  person: {
    birthDate: string | null;
    medicalCertUntil: string | null;
    formSigned: boolean;
  };
};

export type RosterHealthStats = {
  players: number;
  goalkeepers: number;
  coaches: number;
  avgAge: number | null;
};

export type RosterHealthAlerts = {
  duplicateJerseys: number[];
  noJersey: number;
  medicalExpired: number;
  medicalExpiring: number;
  formMissing: number;
  ageOutOfRange: number;
};

export type RosterHealth = {
  stats: RosterHealthStats;
  alerts: RosterHealthAlerts;
  /** Avisos "duros" (rojos): dorsales duplicados, fuera de edad, médico caducado. */
  hardCount: number;
  /** Avisos "blandos" (ámbar): médico por caducar, sin dorsal, sin ficha. */
  softCount: number;
};

const EXPIRING_DAYS = 30;

export function computeRosterHealth(
  memberships: HealthMembership[],
  team: { minBirthYear: number | null; maxBirthYear: number | null },
): RosterHealth {
  const players = memberships.filter((m) => m.role === "player");

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setDate(soon.getDate() + EXPIRING_DAYS);
  const soonStr = soon.toISOString().slice(0, 10);

  const ages = players
    .map((m) => (m.person.birthDate ? calculateAge(m.person.birthDate) : null))
    .filter((age): age is number => age !== null);
  const avgAge =
    ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;

  const jerseyCounts = new Map<number, number>();
  for (const m of players) {
    if (m.jerseyNumber !== null) {
      jerseyCounts.set(m.jerseyNumber, (jerseyCounts.get(m.jerseyNumber) ?? 0) + 1);
    }
  }
  const duplicateJerseys = [...jerseyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((a, b) => a - b);

  const ageOutOfRange =
    team.minBirthYear !== null && team.maxBirthYear !== null
      ? players.filter((m) => {
          if (!m.person.birthDate) return false;
          const year = Number(m.person.birthDate.slice(0, 4));
          return year < team.minBirthYear! || year > team.maxBirthYear!;
        }).length
      : 0;

  const medicalExpired = memberships.filter(
    (m) => m.person.medicalCertUntil !== null && m.person.medicalCertUntil < today,
  ).length;
  const medicalExpiring = memberships.filter(
    (m) =>
      m.person.medicalCertUntil !== null &&
      m.person.medicalCertUntil >= today &&
      m.person.medicalCertUntil <= soonStr,
  ).length;
  const formMissing = memberships.filter((m) => !m.person.formSigned).length;
  const noJersey = players.filter((m) => m.jerseyNumber === null).length;

  const stats: RosterHealthStats = {
    players: players.length,
    goalkeepers: players.filter((m) => m.positions.includes("portero")).length,
    coaches: memberships.filter((m) => m.role === "coach" || m.role === "staff").length,
    avgAge,
  };
  const alerts: RosterHealthAlerts = {
    duplicateJerseys,
    noJersey,
    medicalExpired,
    medicalExpiring,
    formMissing,
    ageOutOfRange,
  };

  const hardCount =
    (duplicateJerseys.length > 0 ? 1 : 0) +
    (ageOutOfRange > 0 ? 1 : 0) +
    (medicalExpired > 0 ? 1 : 0);
  const softCount =
    (medicalExpiring > 0 ? 1 : 0) + (noJersey > 0 ? 1 : 0) + (formMissing > 0 ? 1 : 0);

  return { stats, alerts, hardCount, softCount };
}
