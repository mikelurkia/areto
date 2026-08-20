import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { courtEvents, seasons, teams } from "../src/db/schema";

/**
 * Importación puntual del calendario de partidos Senior 2026/27
 * (https://docs.google.com/spreadsheets/d/1GbnTnSKaYj46Dmbh49aLI43BosfEBk3I0w1D5lwaT3w),
 * snapshot descargado el 2026-08-20. Solo la categoría Senior tiene datos en
 * la hoja; el resto de categorías (Juvenil, Cadete, Infantil A/B) están vacías
 * para todas las jornadas.
 *
 * Semántica confirmada con el club: la columna CASA indica el rival cuando
 * jugamos en NUESTRO campo (isHome = true); FUERA indica el rival cuando
 * jugamos en el suyo (isHome = false). La jornada del 08/11/2026 aparecía en
 * la hoja como "08/15/2026" (mes inválido); se interpreta como 08/11/2026 por
 * encajar con el patrón semanal de domingos del resto de jornadas. Las
 * jornadas sin rival en ninguna columna (descanso) se omiten.
 *
 * Idempotente: omite jornadas para las que ya exista una fila de
 * court_events con el mismo team_id + weekend_of.
 *
 * Uso (DATABASE_URL vive en .env.local, no en .env, hay que exportarla antes):
 *   export DATABASE_URL=$(node -e "require('dotenv').config({path:'.env.local',quiet:true}); process.stdout.write((process.env.DATABASE_URL||'').trim())")
 *   npx tsx scripts/import-calendario-senior-2026-27.ts            (dry-run, no escribe nada)
 *   npx tsx scripts/import-calendario-senior-2026-27.ts --commit    (escribe de verdad)
 */

type Fixture = {
  weekendOf: string; // YYYY-MM-DD
  opponent: string;
  isHome: boolean;
};

const FIXTURES: Fixture[] = [
  { weekendOf: "2026-09-27", opponent: "Iturriondo Sidreria Loiu \"A\"", isHome: false },
  { weekendOf: "2026-10-04", opponent: "Leioa Ibaraki", isHome: true },
  { weekendOf: "2026-10-11", opponent: "Sasikoa Durango Arripu, C.D.", isHome: false },
  { weekendOf: "2026-10-18", opponent: "Soloarte F.C.", isHome: true },
  { weekendOf: "2026-10-25", opponent: "Legorreta Bilkoin", isHome: false },
  { weekendOf: "2026-11-01", opponent: "Elorrioko Buskantza", isHome: true },
  { weekendOf: "2026-11-08", opponent: "Gora Viuda de Sainz", isHome: false }, // hoja: "08/15/2026" (typo), interpretado como 08/11/2026
  { weekendOf: "2026-11-15", opponent: "Arangoiti Aerolink Elorrietako FS, C.D.", isHome: true },
  { weekendOf: "2026-11-22", opponent: "Lagun Onak GDKO Transrapid", isHome: false },
  { weekendOf: "2026-11-29", opponent: "Otxartabe de Bilbao, C.D.D.F. \"B\"", isHome: false },
  { weekendOf: "2026-12-06", opponent: "Sestao F.S.", isHome: true },
  { weekendOf: "2026-12-13", opponent: "Artaromo", isHome: false },
  { weekendOf: "2026-12-20", opponent: "Daster Futbol Club", isHome: true },
  // 2026-12-27 y 2027-01-03: sin rival en la hoja (descanso), se omiten.
  { weekendOf: "2027-01-10", opponent: "Goiztiri \"A\"", isHome: false },
  { weekendOf: "2027-01-17", opponent: "Ibaialde Salburua, QBOSQ", isHome: true },
  { weekendOf: "2027-01-24", opponent: "Iturriondo Sidreria Loiu \"A\"", isHome: true },
  { weekendOf: "2027-01-31", opponent: "Leioa Ibaraki", isHome: false },
  { weekendOf: "2027-02-07", opponent: "Sasikoa Durango Arripu, C.D.", isHome: true },
  { weekendOf: "2027-02-14", opponent: "Soloarte F.C.", isHome: false },
  { weekendOf: "2027-02-21", opponent: "Legorreta Bilkoin", isHome: true },
  { weekendOf: "2027-02-28", opponent: "Elorrioko Buskantza", isHome: false },
  { weekendOf: "2027-03-07", opponent: "Gora Viuda de Sainz", isHome: true },
  // 2027-03-14: sin rival en la hoja (descanso), se omite.
  { weekendOf: "2027-03-21", opponent: "Arangoiti Aerolink Elorrietako FS, C.D.", isHome: false },
  // 2027-03-28 y 2027-04-04: sin rival en la hoja (descanso), se omiten.
  { weekendOf: "2027-04-11", opponent: "Lagun Onak GDKO Transrapid", isHome: false },
  { weekendOf: "2027-04-18", opponent: "Otxartabe de Bilbao, C.D.D.F. \"B\"", isHome: true },
  { weekendOf: "2027-04-25", opponent: "Sestao F.S.", isHome: false },
  { weekendOf: "2027-05-02", opponent: "Artaromo", isHome: true },
  { weekendOf: "2027-05-09", opponent: "Daster Futbol Club", isHome: false },
  { weekendOf: "2027-05-16", opponent: "Goiztiri \"A\"", isHome: true },
  { weekendOf: "2027-05-23", opponent: "Ibaialde Salburua, QBOSQ", isHome: true },
  // 2027-05-30 y 2027-06-06: sin rival en la hoja (descanso), se omiten.
];

async function main() {
  const commit = process.argv.includes("--commit");

  const [team] = await db
    .select({ id: teams.id, seasonName: seasons.name })
    .from(teams)
    .innerJoin(seasons, eq(teams.seasonId, seasons.id))
    .where(and(eq(teams.name, "Senior"), eq(seasons.isCurrent, true)));

  if (!team) {
    throw new Error('No se encontró el equipo "Senior" de la temporada activa.');
  }

  console.log(`Equipo destino: Senior (${team.id}), temporada ${team.seasonName}`);
  console.log(`Modo: ${commit ? "COMMIT (escribe en la base)" : "dry-run (no escribe nada)"}`);
  console.log(`Jornadas en la lista: ${FIXTURES.length}`);

  let inserted = 0;
  let skipped = 0;

  for (const fixture of FIXTURES) {
    const existing = await db.query.courtEvents.findFirst({
      where: (ce, { eq: eqOp, and: andOp }) =>
        andOp(eqOp(ce.teamId, team.id), eqOp(ce.weekendOf, fixture.weekendOf)),
    });

    if (existing) {
      console.log(`  [skip] ${fixture.weekendOf} — ya existe una fila para este equipo/jornada`);
      skipped++;
      continue;
    }

    console.log(
      `  [${commit ? "insert" : "dry-run"}] ${fixture.weekendOf} — ${fixture.isHome ? "CASA" : "FUERA"} vs ${fixture.opponent}`,
    );

    if (commit) {
      await db.insert(courtEvents).values({
        kind: "match",
        teamId: team.id,
        weekendOf: fixture.weekendOf,
        opponent: fixture.opponent,
        isHome: fixture.isHome,
      });
    }

    inserted++;
  }

  console.log(`\n${commit ? "Insertadas" : "A insertar"}: ${inserted}. Omitidas (ya existían): ${skipped}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
