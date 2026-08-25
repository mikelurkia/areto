import "./env";

import { and, count, eq, inArray, ne, notInArray, sql } from "drizzle-orm";

import { db } from "./index";
import {
  clubMembers,
  clubSettings,
  courtEvents,
  federationAccounts,
  invoiceCounters,
  memberships,
  personGuardians,
  personInjuryReports,
  personMedicalCheckups,
  personNotes,
  personQualifications,
  personTags,
  persons,
  registrationGuardians,
  registrations,
  rolePermissions,
  roles,
  seasons,
  sponsorContacts,
  sponsorNotes,
  sponsorPayments,
  sponsors,
  sponsorshipTerms,
  teams,
} from "./schema";
import { seedRoles } from "./seed-roles";
import {
  OPPONENTS,
  SPONSOR_BUSINESSES,
  address,
  city,
  postalCode,
  iban,
  isoDate,
  makeEmailAllocator,
  nationalId,
  personName,
  phone,
  seedId,
  shiftDays,
  taxId,
} from "./seed-data";
import { SYSTEM_ROLE_PERMISSIONS } from "../lib/permissions";
import { seasonLabel, seasonYearOf } from "../lib/sponsorship";

/**
 * Juego de datos de demostración para `areto-dev`. Ejecuta con:
 *
 *   npm run db:seed:demo            siembra (borra antes lo que sembró la vez anterior)
 *   npm run db:seed:demo -- --clean solo borra lo del seed y sale
 *   npm run db:seed:demo -- --force salta la salvaguarda de "esto parece real"
 *
 * Todas las personas, cuentas, DNI y empresas son INVENTADAS (ver
 * `seed-data.ts`). De producción solo se ha copiado la forma de los datos.
 *
 * Cada fila lleva un id determinista (`seedId`), así que el seed reconoce
 * exactamente lo que sembró: borrarlo y volver a sembrarlo deja siempre el
 * mismo estado y no toca ni una fila que no sea suya.
 *
 * Lo que NO se siembra, y por qué:
 *
 * - `events`, `attendances`, `fees`, `payments`, `announcements`: todavía no
 *   hay pantalla que las lea (`/cuotas` y `/avisos` son `SectionPlaceholder`,
 *   y `/calendario` trabaja sobre `court_events`). En producción también
 *   están a cero.
 * - `users`: su `id` tiene que ser el de un `auth.users` real; las crea el
 *   trigger `handle_new_user` al registrarse (`supabase/setup.sql`). Una fila
 *   inventada aquí no serviría para entrar.
 * - Documentos y fotos (`*_documents`, `photoPath`, `contractPath`): apuntan a
 *   objetos de Supabase Storage. Una ruta a un objeto que no existe solo
 *   produce descargas rotas.
 * - `club_settings`, `federation_accounts` y el rol propio del club: se
 *   siembran solo si faltan, nunca se pisan — son ajustes que el club edita a
 *   mano. `federation_accounts` y el rol tampoco se borran (el rol no se puede
 *   borrar si alguien lo tiene puesto); la fila de ajustes sí, si la creó el
 *   seed.
 *
 * Única excepción a "solo toco lo mío": las temporadas. `seasons_name_idx` es
 * único, así que si ya existe una "2026/27" el seed la adopta (le ajusta las
 * fechas y el flag de activa) en vez de duplicarla, y cuelga de ella sus
 * equipos. Al borrar, una temporada adoptada se queda: no la creó el seed.
 *
 * INCOHERENCIAS DELIBERADAS. El dashboard tiene tarjetas de incoherencias y
 * los equipos avisos de salud de plantilla; en verde no se pueden probar. El
 * seed mete cinco casos rotos a propósito, y solo estos cinco:
 *
 *   1. Tres fichas activas sin DNI          → tarjeta "missingNationalId"
 *   2. Dos dorsales 7 en el Cadete          → aviso de plantilla del equipo
 *   3. Dos capitanes en el Juvenil          → tarjeta "duplicateCaptains"
 *   4. Un jugador aprobado sin plantilla    → tarjeta "orphanPlayers"
 *   5. Dos fichas con el apellido casi igual → `/personas/duplicados`
 */

/** Por encima de esto, la base de datos tiene datos de verdad y no es un entorno de pruebas. */
const FOREIGN_PERSONS_LIMIT = 25;

const now = new Date();
const today = isoDate(now);
const seasonYear = seasonYearOf(today);

// ---------------------------------------------------------------------------
// Temporadas y equipos
// ---------------------------------------------------------------------------

const CURRENT_SEASON = seasonLabel(seasonYear);
const PREVIOUS_SEASON = seasonLabel(seasonYear - 1);

const currentSeasonId = seedId(`season:${CURRENT_SEASON}`);
const previousSeasonId = seedId(`season:${PREVIOUS_SEASON}`);

const seasonRows: (typeof seasons.$inferInsert)[] = [
  {
    id: previousSeasonId,
    name: PREVIOUS_SEASON,
    startsOn: `${seasonYear - 1}-09-01`,
    endsOn: `${seasonYear}-08-31`,
    isCurrent: false,
  },
  {
    id: currentSeasonId,
    name: CURRENT_SEASON,
    startsOn: `${seasonYear}-09-01`,
    endsOn: `${seasonYear + 1}-08-31`,
    isCurrent: true,
  },
];

/**
 * `ageFrom`/`ageTo` son las edades que tiene la categoría en la temporada que
 * arranca, y de ahí salen tanto el rango de nacimiento declarado del equipo
 * como las fechas de nacimiento de sus jugadores.
 */
const TEAM_DEFS = [
  { key: "eskola", name: "Eskola", category: "escuela", players: 8, ageFrom: 7, ageTo: 8, group: "Eskola Kirola", renewed: false },
  { key: "infantil-a", name: "Infantil A", category: "infantil", players: 11, ageFrom: 12, ageTo: 13, group: "Territorial", renewed: true },
  { key: "infantil-b", name: "Infantil B", category: "infantil", players: 10, ageFrom: 12, ageTo: 13, group: "Territorial", renewed: false },
  { key: "cadete", name: "Cadete", category: "cadete", players: 11, ageFrom: 14, ageTo: 15, group: "Territorial", renewed: true },
  { key: "juvenil", name: "Juvenil", category: "juvenil", players: 10, ageFrom: 16, ageTo: 17, group: "Territorial", renewed: true },
  { key: "senior", name: "Senior", category: "senior", players: 10, ageFrom: 19, ageTo: 34, group: "Liga Vasca", renewed: true },
] as const;

const teamId = (key: string, season: string) => seedId(`team:${season}:${key}`);

const teamRows: (typeof teams.$inferInsert)[] = [
  // Los equipos de la temporada pasada, para que `previousTeamId` tenga a qué
  // apuntar y `/temporadas` no sea una sola fila.
  ...TEAM_DEFS.filter((t) => t.renewed).map((t) => ({
    id: teamId(t.key, PREVIOUS_SEASON),
    seasonId: previousSeasonId,
    name: t.name,
    category: t.category,
    gender: "masculino" as const,
    minBirthYear: seasonYear - 1 - t.ageTo,
    maxBirthYear: seasonYear - 1 - t.ageFrom,
    federationGroup: t.group,
  })),
  ...TEAM_DEFS.map((t) => ({
    id: teamId(t.key, CURRENT_SEASON),
    seasonId: currentSeasonId,
    name: t.name,
    category: t.category,
    gender: "masculino" as const,
    minBirthYear: seasonYear - t.ageTo,
    maxBirthYear: seasonYear - t.ageFrom,
    federationGroup: t.group,
    previousTeamId: t.renewed ? teamId(t.key, PREVIOUS_SEASON) : null,
  })),
];

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

const emailFor = makeEmailAllocator();

const personRows: (typeof persons.$inferInsert)[] = [];

type Person = typeof persons.$inferInsert & { id: string };

/**
 * Alta de una ficha. El índice correlativo alimenta DNI, IBAN y teléfono, que
 * son únicos por construcción; el `key` alimenta el id determinista.
 */
function addPerson(
  key: string,
  gender: "male" | "female",
  overrides: Partial<typeof persons.$inferInsert> = {},
): Person {
  const n = personRows.length + 1;
  const { firstName, lastName } = personName(n, gender);
  const row: Person = {
    id: seedId(`person:${key}`),
    firstName,
    lastName,
    email: emailFor(firstName, lastName),
    phone: phone(n),
    nationalId: nationalId(n),
    address: address(n),
    city: city(n),
    postalCode: postalCode(n),
    privacyConsent: true,
    privacyConsentAt: now,
    ...overrides,
  };
  personRows.push(row);
  return row;
}

/** Fecha de nacimiento repartida por el rango de edad del equipo. */
function birthDateFor(index: number, ageFrom: number, ageTo: number): string {
  const span = ageTo - ageFrom + 1;
  const year = seasonYear - ageFrom - (index % span);
  const month = 1 + ((index * 5) % 12);
  const day = 1 + ((index * 7) % 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// --- Tutores -----------------------------------------------------------------
// Los doce primeros tienen dos hijos en el club (hermanos), que es lo que pasa
// de verdad en un club de pueblo; el resto, uno.

const GUARDIAN_COUNT = 38;

const guardians: Person[] = Array.from({ length: GUARDIAN_COUNT }, (_, i) =>
  addPerson(`tutor-${i}`, i % 2 === 0 ? "female" : "male", {
    birthDate: birthDateFor(i, 36, 54),
    iban: iban(1000 + i),
    sepaConsent: true,
    sepaConsentAt: now,
  }),
);

function guardianForMinor(minorIndex: number): Person {
  return guardians[minorIndex < 24 ? Math.floor(minorIndex / 2) : 12 + (minorIndex - 24)];
}

// --- Cuerpo técnico ----------------------------------------------------------

const coaches = TEAM_DEFS.map((t, i) =>
  addPerson(`entrenatzailea-${t.key}`, i % 3 === 0 ? "female" : "male", {
    birthDate: birthDateFor(i, 28, 52),
    iban: iban(2000 + i),
    sepaConsent: true,
    sepaConsentAt: now,
    photoConsent: true,
    photoConsentAt: now,
  }),
);

const delegates = ["senior", "juvenil"].map((teamKey, i) =>
  addPerson(`ordezkaria-${teamKey}`, i === 0 ? "male" : "female", {
    birthDate: birthDateFor(i, 40, 58),
  }),
);

// --- Jugadores ---------------------------------------------------------------

/** Fichas activas sin DNI (incoherencia deliberada nº 1). */
const MISSING_DNI_KEYS = new Set(["jokalaria-cadete-3", "jokalaria-juvenil-6", "jokalaria-senior-2"]);

type Player = { person: Person; teamKey: string; index: number };

const players: Player[] = [];
let minorIndex = 0;

for (const team of TEAM_DEFS) {
  for (let i = 0; i < team.players; i++) {
    const key = `jokalaria-${team.key}-${i}`;
    const birthDate = birthDateFor(i, team.ageFrom, team.ageTo);
    const adult = team.ageFrom >= 18;

    // Un menor no puede ser titular de un mandato SEPA: paga su tutor
    // principal y la ficha solo queda enlazada a él (ver `resolvePayerFields`).
    const guardian = adult ? null : guardianForMinor(minorIndex++);

    const person = addPerson(key, "male", {
      birthDate,
      payerPersonId: guardian?.id ?? null,
      iban: adult ? iban(3000 + players.length) : null,
      sepaConsent: adult,
      sepaConsentAt: adult ? now : null,
      shirtSize: ["XS", "S", "M", "L", "XL"][(i + team.ageFrom) % 5],
      pantsSize: ["XS", "S", "M", "L", "XL"][(i + team.ageFrom + 1) % 5],
      shoeSize: String(34 + ((i * 3) % 12)),
      photoConsent: i % 4 !== 0,
      photoConsentAt: i % 4 !== 0 ? now : null,
      termsConsent: true,
      termsConsentAt: now,
      // El contacto de un menor es el de su tutor: la secretaría no tiene otro.
      ...(guardian ? { phone: guardian.phone, email: null } : {}),
    });

    if (MISSING_DNI_KEYS.has(key)) person.nationalId = null;
    players.push({ person, teamKey: team.key, index: i });
  }
}

// --- Socios sin equipo -------------------------------------------------------

const standaloneMembers = Array.from({ length: 8 }, (_, i) =>
  addPerson(`bazkidea-${i}`, i % 2 === 0 ? "male" : "female", {
    birthDate: birthDateFor(i, 30, 70),
    iban: iban(4000 + i),
    sepaConsent: true,
    sepaConsentAt: now,
  }),
);

// --- Fichas de las incoherencias ---------------------------------------------

/** nº 4: aprobado desde el formulario web pero sin equipo asignado. */
const orphanPlayer = addPerson("jokalari-umezurtza", "male", {
  birthDate: birthDateFor(3, 19, 30),
  iban: iban(5000),
  sepaConsent: true,
  sepaConsentAt: now,
});

/**
 * nº 5: la misma persona tecleada dos veces con el apellido mal transcrito,
 * que es como llegan los duplicados de verdad (`isFuzzyNameMatch` los agrupa).
 */
addPerson("bikoiztua", "male", {
  firstName: guardians[5].firstName,
  lastName: `${guardians[5].lastName!.split(" ")[0]}ga ${guardians[5].lastName!.split(" ")[1]}`,
  email: null,
  birthDate: guardians[5].birthDate,
  nationalId: null,
});

// ---------------------------------------------------------------------------
// Tutores, socios y plantillas
// ---------------------------------------------------------------------------

const guardianRows: (typeof personGuardians.$inferInsert)[] = players
  .filter((p) => p.person.payerPersonId)
  .map((p) => ({
    id: seedId(`guardian:${p.person.id}`),
    personId: p.person.id,
    guardianId: p.person.payerPersonId!,
    isPrimary: true,
  }));

/** Socios: los adultos del club (senior, técnicos), un tercio de los tutores y los sueltos. */
const memberPersons: Person[] = [
  ...players.filter((p) => p.teamKey === "senior").map((p) => p.person),
  ...coaches,
  ...delegates,
  ...guardians.filter((_, i) => i % 3 === 0),
  ...standaloneMembers,
];

const clubMemberRows: (typeof clubMembers.$inferInsert)[] = memberPersons.map((person, i) => ({
  id: seedId(`member:${person.id}`),
  personId: person.id,
  // Las dos últimas son bajas: el histórico se conserva, no se borra.
  status: i >= memberPersons.length - 2 ? ("cancelled" as const) : ("active" as const),
  memberNumber: i + 1,
  joinedAt: shiftDays(now, -900 + i * 11),
  cancelledAt: i >= memberPersons.length - 2 ? shiftDays(now, -60) : null,
}));

const membershipRows: (typeof memberships.$inferInsert)[] = [];

const POSITIONS = ["cierre", "ala", "pivot"] as const;

for (const team of TEAM_DEFS) {
  const roster = players.filter((p) => p.teamKey === team.key);
  for (const { person, index } of roster) {
    membershipRows.push({
      id: seedId(`membership:${CURRENT_SEASON}:${team.key}:${index}`),
      personId: person.id,
      teamId: teamId(team.key, CURRENT_SEASON),
      role: "player",
      // nº 2: en el Cadete hay dos dorsales 7.
      jerseyNumber: team.key === "cadete" && index === 8 ? 7 : index + 1,
      positions: index === 0 ? ["portero"] : [POSITIONS[index % POSITIONS.length]],
      // nº 3: el Juvenil tiene dos capitanes marcados.
      isCaptain: index === 1 || (team.key === "juvenil" && index === 4),
      joinedAt: `${seasonYear}-09-01`,
    });
  }
}

TEAM_DEFS.forEach((team, i) => {
  membershipRows.push({
    id: seedId(`membership:${CURRENT_SEASON}:${team.key}:coach`),
    personId: coaches[i].id,
    teamId: teamId(team.key, CURRENT_SEASON),
    role: "coach",
    joinedAt: `${seasonYear}-09-01`,
  });
});

["senior", "juvenil"].forEach((teamKey, i) => {
  membershipRows.push({
    id: seedId(`membership:${CURRENT_SEASON}:${teamKey}:staff`),
    personId: delegates[i].id,
    teamId: teamId(teamKey, CURRENT_SEASON),
    role: "staff",
    position: i === 0 ? "Delegado" : "2ª entrenadora",
    joinedAt: `${seasonYear}-09-01`,
  });
});

/**
 * Plantilla de la temporada pasada: los mismos jugadores, pero solo dos
 * tercios de cada equipo — el resto son altas de este año, que es lo que hace
 * que la pantalla de renovaciones tenga algo que enseñar.
 */
for (const team of TEAM_DEFS.filter((t) => t.renewed)) {
  const roster = players.filter((p) => p.teamKey === team.key);
  for (const { person, index } of roster.slice(0, Math.ceil(roster.length * 0.66))) {
    membershipRows.push({
      id: seedId(`membership:${PREVIOUS_SEASON}:${team.key}:${index}`),
      personId: person.id,
      teamId: teamId(team.key, PREVIOUS_SEASON),
      role: "player",
      jerseyNumber: index + 1,
      positions: index === 0 ? ["portero"] : [POSITIONS[index % POSITIONS.length]],
      joinedAt: `${seasonYear - 1}-09-01`,
    });
  }
}

// ---------------------------------------------------------------------------
// Reconocimientos médicos
// ---------------------------------------------------------------------------

/**
 * Solo cadete y superior compiten en federado y necesitan reconocimiento
 * (`categoryRequiresMedicalCheckup`); escuela e infantil salen "exentos" del
 * panel médico por su categoría, sin tocar nada.
 *
 * El reparto es a propósito: los cuatro estados que distingue
 * `medicalCertStatus` tienen que tener a alguien, o los filtros de `/medico`
 * devuelven listas vacías.
 */
const MEDICAL_TEAM_KEYS = ["cadete", "juvenil", "senior"];

const medicalPeople: Person[] = [
  ...players.filter((p) => MEDICAL_TEAM_KEYS.includes(p.teamKey)).map((p) => p.person),
  ...TEAM_DEFS.map((t, i) => (MEDICAL_TEAM_KEYS.includes(t.key) ? coaches[i] : null)).filter(
    (c): c is Person => c !== null,
  ),
  ...delegates,
];

const checkupRows: (typeof personMedicalCheckups.$inferInsert)[] = [];

medicalPeople.forEach((person, i) => {
  const kind = i % 6;
  if (kind === 0) {
    person.medicalCertUntil = null; // sin reconocimiento
    return;
  }

  const occurredOn =
    kind === 1 ? shiftDays(now, -405) : kind === 2 ? shiftDays(now, -340) : shiftDays(now, -150 - i);
  const expiresOn =
    kind === 1 ? shiftDays(now, -40) : kind === 2 ? shiftDays(now, 25) : shiftDays(now, 215 - i);

  // Algunos arrastran el del año anterior: el panel se queda con el más
  // reciente por `occurredOn`, igual que `recomputeMedicalCertUntil`.
  if (i % 5 === 0) {
    checkupRows.push({
      id: seedId(`checkup:${person.id}:previo`),
      personId: person.id,
      occurredOn: shiftDays(now, -740),
      expiresOn: shiftDays(now, -375),
      issuer: "Osasun Zentroa Oñati",
    });
  }

  checkupRows.push({
    id: seedId(`checkup:${person.id}`),
    personId: person.id,
    occurredOn,
    expiresOn,
    issuer: i % 3 === 0 ? "Klub Medikua" : "Osasun Zentroa Oñati",
  });
  person.medicalCertUntil = expiresOn;
});

const injuryRows: (typeof personInjuryReports.$inferInsert)[] = [
  ["Esku-muturreko bihurritua entrenamenduan.", -95],
  ["Orkatilaren lokadura, hiru asteko atsedena.", -62],
  ["Belauneko kolpea partidan, azterketa egiteke.", -28],
  ["Bizkarreko kontraktura, fisioterapiara bidalia.", -9],
].map(([description, days], i) => ({
  id: seedId(`injury:${i}`),
  personId: players.filter((p) => p.teamKey === "senior")[i].person.id,
  occurredOn: shiftDays(now, days as number),
  description: description as string,
  notes: i === 2 ? "Falta el parte del traumatólogo." : null,
}));

const qualificationRows: (typeof personQualifications.$inferInsert)[] = coaches.map(
  (coach, i) => ({
    id: seedId(`qualification:${coach.id}`),
    personId: coach.id,
    title: `Areto futbol entrenatzailea, ${i % 2 === 0 ? "I" : "II"}. maila`,
    issuer: "Euskadiko Futbol Federazioa",
    issuedOn: shiftDays(now, -1200 - i * 90),
    expiresOn: i === 1 ? shiftDays(now, -30) : shiftDays(now, 600 + i * 40),
  }),
);

const tagRows: (typeof personTags.$inferInsert)[] = [
  ...players.filter((_, i) => i % 17 === 0).map((p, i) => ({
    id: seedId(`tag:beka:${i}`),
    personId: p.person.id,
    tag: "beca",
  })),
  ...players
    .filter((p) => p.teamKey === "senior")
    .slice(0, 4)
    .map((p, i) => ({
      id: seedId(`tag:beteranoa:${i}`),
      personId: p.person.id,
      tag: "veterano",
    })),
];

const noteRows: (typeof personNotes.$inferInsert)[] = [
  "Llamó la familia: este trimestre no puede venir a los entrenamientos del martes.",
  "Pendiente de entregar la equipación de la temporada pasada.",
  "Pide fraccionar la cuota en tres plazos.",
  "Cambio de número de teléfono, actualizado en la ficha.",
  "Se apunta al torneo de Navidad.",
  "Traslado a otro club pendiente de confirmar en la federación.",
].map((body, i) => ({
  id: seedId(`note:${i}`),
  personId: players[i * 7].person.id,
  body,
  authorName: "Idazkaritza",
}));

// ---------------------------------------------------------------------------
// Calendario: peticiones de cancha
// ---------------------------------------------------------------------------

/** Primer sábado a partir del 1 de octubre de la temporada en curso. */
function firstSaturday(): Date {
  const date = new Date(Date.UTC(seasonYear, 9, 1));
  while (date.getUTCDay() !== 6) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

const courtEventRows: (typeof courtEvents.$inferInsert)[] = [];
const seasonStart = firstSaturday();

for (const [teamKey, matches] of [
  ["senior", 30],
  ["juvenil", 10],
] as const) {
  for (let round = 0; round < matches; round++) {
    const isHome = round % 2 === 0;
    courtEventRows.push({
      id: seedId(`court:${teamKey}:${round}`),
      kind: "match",
      teamId: teamId(teamKey, CURRENT_SEASON),
      weekendOf: shiftDays(seasonStart, round * 7 + (teamKey === "juvenil" ? 7 : 0)),
      opponent: OPPONENTS[(round * 3 + teamKey.length) % OPPONENTS.length],
      isHome,
      preferredDay: isHome ? (["saturday", "sunday", "either"] as const)[round % 3] : null,
      notes: isHome && round % 8 === 0 ? "Pista ocupada por el torneo escolar hasta las 18:00." : null,
    });
  }
}

// ---------------------------------------------------------------------------
// Patrocinadores
// ---------------------------------------------------------------------------

type SponsorPlan = {
  tier: "principal" | "colaborador" | "publicidad";
  status: "negotiating" | "confirmed" | "lost";
  /** Importe TOTAL del acuerdo, en céntimos (la columna se llama `amount_cents`). */
  totalCents: number | null;
  /** Temporadas que dura el acuerdo. */
  years: number;
};

/** Repartos calcados de la mezcla real: un principal plurianual y una cola larga de colaboradores. */
const SPONSOR_PLANS: SponsorPlan[] = SPONSOR_BUSINESSES.map((_, i) => {
  if (i === 0) return { tier: "principal", status: "confirmed", totalCents: 600_000, years: 3 };
  if (i === 1) return { tier: "principal", status: "confirmed", totalCents: 300_000, years: 2 };
  if (i === 12) return { tier: "colaborador", status: "negotiating", totalCents: 90_000, years: 1 };
  if (i === 13) return { tier: "colaborador", status: "lost", totalCents: null, years: 0 };
  if (i % 5 === 0) return { tier: "publicidad", status: "confirmed", totalCents: 15_000, years: 1 };
  return {
    tier: "colaborador",
    status: "confirmed",
    totalCents: 20_000 + ((i * 17_000) % 120_000),
    years: i % 4 === 0 ? 2 : 1,
  };
});

const sponsorRows: (typeof sponsors.$inferInsert)[] = [];
const termRows: (typeof sponsorshipTerms.$inferInsert)[] = [];
const sponsorPaymentRows: (typeof sponsorPayments.$inferInsert)[] = [];

let invoiceNumber = 0;

SPONSOR_BUSINESSES.forEach((business, i) => {
  const plan = SPONSOR_PLANS[i];
  const sponsorId = seedId(`sponsor:${business.key}`);

  sponsorRows.push({
    id: sponsorId,
    name: business.name,
    contactEmail: `${business.key}@example.test`,
    contactPhone: phone(6000 + i),
    websiteUrl: i % 3 === 0 ? `https://${business.key}.example.test` : null,
    fiscalName: business.fiscalName,
    taxId: taxId(i),
    fiscalAddress: `${address(i)}, 20560 Oñati`,
    notes: i % 4 === 0 ? `${business.activity}. Renueva siempre en septiembre.` : null,
  });

  const termId = seedId(`term:${business.key}`);
  const startYear = plan.status === "lost" ? seasonYear : seasonYear;

  termRows.push({
    id: termId,
    sponsorId,
    tier: plan.tier,
    agreementStatus: plan.status,
    totalAmountCents: plan.totalCents,
    startsOn: `${startYear}-09-01`,
    endsOn: plan.years > 0 ? `${startYear + plan.years}-08-31` : null,
    benefits:
      plan.tier === "principal"
        ? "Logo en la camiseta, valla en la cancha y mención en la web."
        : plan.tier === "colaborador"
          ? "Logo en el muro de patrocinadores y en la web."
          : "Valla publicitaria en la cancha.",
  });

  // Las anualidades reparten el total exacto: si no cuadran, el dashboard lo
  // marca como incoherencia (`countSponsorshipMismatches`).
  if (plan.totalCents === null || plan.years === 0) return;
  const base = Math.floor(plan.totalCents / plan.years);
  for (let y = 0; y < plan.years; y++) {
    const amountCents = y === plan.years - 1 ? plan.totalCents - base * (plan.years - 1) : base;
    const year = startYear + y;
    const isFirstYear = y === 0;
    const invoiced = plan.status === "confirmed" && isFirstYear && i % 2 === 0;
    const paid = invoiced && i % 4 === 0;

    sponsorPaymentRows.push({
      id: seedId(`sponsor-payment:${business.key}:${year}`),
      termId,
      year,
      amountCents,
      status: paid ? "paid" : !isFirstYear ? "pending" : i % 7 === 3 ? "overdue" : "pending",
      dueDate: `${year}-11-30`,
      paidOn: paid ? `${year}-10-14` : null,
      method: paid ? "transfer" : null,
      invoiceNumber: invoiced ? `${seasonYear}/${String(++invoiceNumber).padStart(4, "0")}` : null,
      invoicedOn: invoiced ? `${year}-10-01` : null,
    });
  }
});

const sponsorContactRows: (typeof sponsorContacts.$inferInsert)[] = SPONSOR_BUSINESSES.slice(0, 6).map(
  (business, i) => {
    const { firstName, lastName } = personName(7000 + i, i % 2 === 0 ? "female" : "male");
    return {
      id: seedId(`sponsor-contact:${business.key}`),
      sponsorId: seedId(`sponsor:${business.key}`),
      name: `${firstName} ${lastName}`,
      role: ["Gerencia", "Administración", "Comercial"][i % 3],
      email: `${business.key}.${i}@example.test`,
      phone: phone(8000 + i),
    };
  },
);

const sponsorNoteRows: (typeof sponsorNotes.$inferInsert)[] = [
  "Reunión en la tienda: renueva otro año, mismo importe.",
  "Pide que el logo salga también en la equipación de entrenamiento.",
  "No renueva esta temporada, cierran el local.",
  "Prefiere que la factura se emita en enero, no en octubre.",
  "Interesados en patrocinar el torneo de Navidad aparte.",
].map((body, i) => ({
  id: seedId(`sponsor-note:${i}`),
  sponsorId: seedId(`sponsor:${SPONSOR_BUSINESSES[i * 2].key}`),
  body,
  authorName: "Diruzaintza",
}));

// ---------------------------------------------------------------------------
// Inscripciones del formulario público
// ---------------------------------------------------------------------------

type RegistrationPlan = {
  key: string;
  kind: "player" | "member";
  status: "pending" | "approved" | "rejected";
  /** Ficha ya existente que el revisor confirmó como la misma persona. */
  matched?: Person;
  minor?: boolean;
  rejectionReason?: string;
};

const REGISTRATION_PLANS: RegistrationPlan[] = [
  { key: "berria-1", kind: "player", status: "pending", minor: true },
  { key: "berria-2", kind: "player", status: "pending", minor: true },
  { key: "berria-3", kind: "player", status: "pending" },
  { key: "berria-4", kind: "player", status: "pending" },
  { key: "bazkide-1", kind: "member", status: "pending" },
  { key: "bazkide-2", kind: "member", status: "pending" },
  { key: "berritzea-1", kind: "player", status: "approved", matched: players[45].person },
  { key: "berritzea-2", kind: "player", status: "approved", matched: players[52].person },
  { key: "umezurtza", kind: "player", status: "approved", matched: orphanPlayer },
  {
    key: "ukatua-1",
    kind: "player",
    status: "rejected",
    rejectionReason: "Duplicada: ya se inscribió en septiembre.",
  },
  {
    key: "ukatua-2",
    kind: "member",
    status: "rejected",
    rejectionReason: "Datos incompletos, se le pidió repetir el formulario.",
  },
];

const registrationRows: (typeof registrations.$inferInsert)[] = [];
const registrationGuardianRows: (typeof registrationGuardians.$inferInsert)[] = [];

REGISTRATION_PLANS.forEach((plan, i) => {
  const n = 9000 + i;
  const identity = plan.matched
    ? {
        firstName: plan.matched.firstName,
        lastName: plan.matched.lastName,
        birthDate: plan.matched.birthDate ?? null,
        nationalId: plan.matched.nationalId ?? null,
        email: plan.matched.email ?? null,
        phone: plan.matched.phone ?? null,
      }
    : (() => {
        const { firstName, lastName } = personName(n, i % 3 === 0 ? "female" : "male");
        return {
          firstName,
          lastName,
          birthDate: birthDateFor(i, plan.minor ? 12 : 24, plan.minor ? 15 : 45),
          nationalId: nationalId(n),
          email: `${plan.key}@example.test`,
          phone: phone(n),
        };
      })();

  const registrationId = seedId(`registration:${plan.key}`);
  const isPlayer = plan.kind === "player";

  registrationRows.push({
    id: registrationId,
    kind: plan.kind,
    status: plan.status,
    seasonId: currentSeasonId,
    ...identity,
    address: address(n),
    city: city(n),
    postalCode: postalCode(n),
    iban: plan.minor ? null : iban(n),
    shirtSize: isPlayer ? ["S", "M", "L"][i % 3] : null,
    pantsSize: isPlayer ? ["S", "M", "L"][(i + 1) % 3] : null,
    shoeSize: isPlayer ? String(38 + (i % 8)) : null,
    installmentsChosen: isPlayer ? [1, 2, 3][i % 3] : null,
    sepaConsent: !plan.minor,
    sepaConsentAt: plan.minor ? null : now,
    termsConsent: isPlayer,
    termsConsentAt: isPlayer ? now : null,
    photoConsent: i % 3 !== 0,
    photoConsentAt: i % 3 !== 0 ? now : null,
    privacyConsent: true,
    privacyConsentAt: now,
    matchedPersonId: plan.matched?.id ?? null,
    reviewedAt: plan.status === "pending" ? null : now,
    rejectionReason: plan.rejectionReason ?? null,
  });

  if (plan.minor) {
    const { firstName, lastName } = personName(n + 500, i % 2 === 0 ? "female" : "male");
    registrationGuardianRows.push({
      id: seedId(`registration-guardian:${plan.key}`),
      registrationId,
      firstName,
      lastName,
      birthDate: birthDateFor(i, 38, 50),
      nationalId: nationalId(n + 500),
      address: address(n),
      city: city(n),
      postalCode: postalCode(n),
      phone: phone(n + 500),
      email: `${plan.key}.tutor@example.test`,
      sortOrder: 0,
    });
  }
});

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

/** Todos los ids que el seed reclama como suyos, por tabla. */
const seedIds = {
  registrations: registrationRows.map((r) => r.id!),
  courtEvents: courtEventRows.map((r) => r.id!),
  sponsors: sponsorRows.map((r) => r.id!),
  memberships: membershipRows.map((r) => r.id!),
  persons: personRows.map((r) => r.id!),
  teams: teamRows.map((r) => r.id!),
  seasons: seasonRows.map((r) => r.id!),
};

/**
 * Borra exactamente lo que sembró el seed. Los hijos (plantillas, tutores,
 * reconocimientos, notas, anualidades...) caen solos por `on delete cascade`;
 * aquí solo van los padres, en orden de dependencia.
 *
 * No se tocan `club_settings`, `federation_accounts`, `invoice_counters` ni el
 * rol propio del club: son ajustes compartidos, y el contador de facturas no
 * puede retroceder sin arriesgarse a repetir un número.
 */
async function deleteSeedRows() {
  await db.delete(registrations).where(inArray(registrations.id, seedIds.registrations));
  await db.delete(courtEvents).where(inArray(courtEvents.id, seedIds.courtEvents));
  await db.delete(memberships).where(inArray(memberships.id, seedIds.memberships));
  await db.delete(sponsors).where(inArray(sponsors.id, seedIds.sponsors));
  await db.delete(persons).where(inArray(persons.id, seedIds.persons));
  await db.delete(teams).where(inArray(teams.id, seedIds.teams));
  await db.delete(seasons).where(inArray(seasons.id, seedIds.seasons));
  await db.delete(clubSettings).where(eq(clubSettings.id, seedId("club-settings")));
}

/** Rol propio del club, como el que hay en producción además de los cuatro de fábrica. */
async function seedCustomRole() {
  const roleId = seedId("role:presidente");
  await db
    .insert(roles)
    .values({
      id: roleId,
      key: "presidente",
      name: "Presidentea",
      description: "Klubaren lehendakaria: idazkaritzaren ikuspegi osoa.",
      isSystem: false,
      isDefault: false,
      sortOrder: 100,
    })
    .onConflictDoNothing({ target: roles.key });

  await db
    .insert(rolePermissions)
    .values(SYSTEM_ROLE_PERMISSIONS.staff.map((permission) => ({ roleId, permission })))
    .onConflictDoNothing();
}

/** Ajustes del club y credenciales de federación: solo si faltan. */
async function seedClubSettings() {
  // `club_settings` es una tabla singleton (se lee siempre la primera fila),
  // así que aquí no vale un `onConflictDoNothing`: hay que mirar si ya hay una.
  const [settings] = await db.select({ value: count() }).from(clubSettings);
  if ((settings?.value ?? 0) > 0) {
    console.log("   Ya había ajustes del club: se dejan como estaban.");
  } else {
    await db.insert(clubSettings).values({
      id: seedId("club-settings"),
      legalName: "Areto Kirol Kluba",
      taxId: `G${taxId(1).slice(1)}`,
      address: "Kale Zaharra 1, 20560 Oñati (Gipuzkoa)",
      email: "idazkaritza@example.test",
      phone: phone(1),
      iban: iban(1),
      federationCode: "2022",
      playerRegistrationOpen: true,
      memberRegistrationOpen: true,
      memberAnnualFeeCents: 2000,
    });
  }

  await db
    .insert(federationAccounts)
    .values([
      {
        id: seedId("federation:gipuzkoana"),
        name: "Gipuzkoana",
        url: "https://intranet.gipuzkoafutbola.eus/nfg/",
        username: "areto.demo",
        password: "demo-pasahitza",
      },
      {
        id: seedId("federation:vasca"),
        name: "Vasca",
        url: "https://intranet.euskadifutbol.eus/nfg/",
        username: "areto.demo",
        password: "demo-pasahitza",
      },
    ])
    .onConflictDoNothing({ target: federationAccounts.name });
}

/**
 * Deja las dos temporadas en su sitio y devuelve sus ids reales.
 *
 * Si ya existe una temporada con ese nombre (el `db:seed` mínimo crea una, y
 * `seasons_name_idx` es único) el seed la ADOPTA en vez de duplicarla: le pone
 * las fechas y el flag de activa que le tocan, y cuelga de ella sus equipos.
 * Por eso los ids de temporada no se pueden dar por deterministas como los del
 * resto de tablas, y hay que resolverlos antes de insertar nada que los use.
 */
async function ensureSeasons(): Promise<{ current: string; previous: string }> {
  // Solo puede haber una temporada activa (índice único parcial
  // `seasons_current_idx`), así que primero se apaga la que hubiera.
  const deactivated = await db
    .update(seasons)
    .set({ isCurrent: false })
    .where(and(eq(seasons.isCurrent, true), ne(seasons.name, CURRENT_SEASON)))
    .returning({ name: seasons.name });
  for (const season of deactivated) {
    console.log(`   La temporada "${season.name}" deja de ser la activa: lo pasa a ser ${CURRENT_SEASON}.`);
  }

  const resolved = new Map<string, string>();
  for (const row of seasonRows) {
    const existing = await db.query.seasons.findFirst({ where: eq(seasons.name, row.name!) });
    if (existing) {
      await db
        .update(seasons)
        .set({ startsOn: row.startsOn, endsOn: row.endsOn, isCurrent: row.isCurrent })
        .where(eq(seasons.id, existing.id));
      resolved.set(row.name!, existing.id);
    } else {
      await db.insert(seasons).values(row);
      resolved.set(row.name!, row.id!);
    }
  }
  return {
    current: resolved.get(CURRENT_SEASON)!,
    previous: resolved.get(PREVIOUS_SEASON)!,
  };
}

async function insertSeedRows(seasonIds: { current: string; previous: string }) {
  for (const team of teamRows) {
    team.seasonId = team.seasonId === currentSeasonId ? seasonIds.current : seasonIds.previous;
  }
  for (const registration of registrationRows) registration.seasonId = seasonIds.current;

  // El número de socio es correlativo y único en toda la tabla: si la base ya
  // tenía altas que no son del seed, las del seed siguen a partir de la última.
  const [highest] = await db
    .select({ value: sql<number>`coalesce(max(${clubMembers.memberNumber}), 0)` })
    .from(clubMembers);
  clubMemberRows.forEach((row, i) => {
    row.memberNumber = (highest?.value ?? 0) + i + 1;
  });

  await db.insert(teams).values(teamRows);
  await db.insert(persons).values(personRows);
  await db.insert(personGuardians).values(guardianRows);
  await db.insert(clubMembers).values(clubMemberRows);
  await db.insert(memberships).values(membershipRows);
  await db.insert(personMedicalCheckups).values(checkupRows);
  await db.insert(personInjuryReports).values(injuryRows);
  await db.insert(personQualifications).values(qualificationRows);
  await db.insert(personTags).values(tagRows);
  await db.insert(personNotes).values(noteRows);
  await db.insert(courtEvents).values(courtEventRows);
  await db.insert(sponsors).values(sponsorRows);
  await db.insert(sponsorshipTerms).values(termRows);
  await db.insert(sponsorPayments).values(sponsorPaymentRows);
  await db.insert(sponsorContacts).values(sponsorContactRows);
  await db.insert(sponsorNotes).values(sponsorNoteRows);
  await db.insert(registrations).values(registrationRows);
  await db.insert(registrationGuardians).values(registrationGuardianRows);

  // El contador nunca retrocede: si la base ya iba por un número más alto que
  // el de las facturas del seed, se queda como estaba.
  await db
    .insert(invoiceCounters)
    .values({ year: seasonYear, lastNumber: invoiceNumber })
    .onConflictDoUpdate({
      target: invoiceCounters.year,
      set: { lastNumber: sql`greatest(${invoiceCounters.lastNumber}, excluded.last_number)` },
    });
}

/**
 * Corta si la base de datos tiene fichas que no son del seed: eso son datos
 * reales (producción tiene casi 200 personas), no un entorno de pruebas.
 */
async function assertScratchDatabase(force: boolean) {
  const [row] = await db
    .select({ value: count() })
    .from(persons)
    .where(notInArray(persons.id, seedIds.persons));
  const foreign = row?.value ?? 0;

  const fichas = `${foreign} ${foreign === 1 ? "ficha" : "fichas"}`;
  console.log(
    `   ${fichas} ${foreign === 1 ? "ajena" : "ajenas"} al seed en esta base de datos.`,
  );
  if (foreign <= FOREIGN_PERSONS_LIMIT || force) return;

  console.error(
    `\n❌ Esta base de datos tiene ${fichas} que no ha creado el seed: parece\n` +
      "   la de producción o una con datos de verdad, no un entorno de pruebas.\n" +
      "   Revisa DATABASE_URL. Si de verdad quieres seguir: npm run db:seed:demo -- --force\n",
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const clean = args.includes("--clean");
  const force = args.includes("--force");

  if (process.env.NODE_ENV === "production") {
    console.error("❌ El seed de demostración no se ejecuta con NODE_ENV=production.");
    process.exit(1);
  }

  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`🌱 Seed de demostración sobre ${host}`);

  await assertScratchDatabase(force);
  await deleteSeedRows();

  if (clean) {
    console.log("🧹 Datos del seed borrados. Nada sembrado (--clean).");
    // El seed pudo haber desactivado la temporada que estaba activa, y al
    // borrar la suya no queda ninguna: sin temporada activa la app no enseña
    // casi nada, así que más vale decirlo que dejarlo pasar.
    const [active] = await db
      .select({ value: count() })
      .from(seasons)
      .where(eq(seasons.isCurrent, true));
    if ((active?.value ?? 0) === 0) {
      console.log("⚠️  No queda ninguna temporada activa: marca una en /temporadas.");
    }
    process.exit(0);
  }

  await seedRoles();
  await seedCustomRole();
  await seedClubSettings();
  await insertSeedRows(await ensureSeasons());

  console.log(
    [
      "✅ Sembrado:",
      `   ${seasonRows.length} temporadas y ${teamRows.length} equipos`,
      `   ${personRows.length} personas (${players.length} jugadores, ${guardians.length} tutores, ${clubMemberRows.length} socios)`,
      `   ${membershipRows.length} fichas de plantilla y ${checkupRows.length} reconocimientos médicos`,
      `   ${courtEventRows.length} peticiones de cancha`,
      `   ${sponsorRows.length} patrocinadores, ${termRows.length} acuerdos y ${sponsorPaymentRows.length} anualidades`,
      `   ${registrationRows.length} inscripciones`,
      "   (5 incoherencias deliberadas: ver la cabecera de seed-demo.ts)",
    ].join("\n"),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en el seed de demostración:", err);
  process.exit(1);
});
