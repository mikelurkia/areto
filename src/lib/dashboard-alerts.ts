import "server-only";

import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons, registrations } from "@/db/schema";
import { isActivePlayer } from "@/lib/membership";
import { categoryRequiresMedicalCheckup } from "@/components/equipos/team-categories";

/**
 * Conteos del panel de alertas. Deliberadamente sin `"use cache"`: son los
 * números que el usuario espera ver cambiar en cuanto atiende una solicitud,
 * y una caché de minutos haría que el panel mintiera justo después de actuar.
 */

export type PendingRegistrationCounts = { player: number; member: number };

/**
 * Solicitudes web sin atender, jugador y socio por separado: se revisan en
 * pantallas distintas (`/inscripciones` y `/socios`). Un solo `count(*)`
 * agrupado por `kind`, en vez de traer las filas para hacer `.length`.
 */
export async function countPendingRegistrations(): Promise<PendingRegistrationCounts> {
  const rows = await db
    .select({ kind: registrations.kind, total: sql<number>`count(*)::int` })
    .from(registrations)
    .where(eq(registrations.status, "pending"))
    .groupBy(registrations.kind);

  return {
    player: rows.find((r) => r.kind === "player")?.total ?? 0,
    member: rows.find((r) => r.kind === "member")?.total ?? 0,
  };
}

export type MedicalCertAlert = { expired: number; expiring: number; total: number };

/**
 * Jugadores con ficha en un equipo de la temporada actual cuya categoría exige
 * reconocimiento médico (cadete o superior) y cuyo certificado ya ha caducado o
 * caduca dentro de la ventana de aviso. Solo el recuento: el detalle con
 * nombres vive en `/medico`.
 *
 * Quien no tiene ninguna fecha registrada no entra aquí (no ha "caducado"
 * nada); ese caso lo cubre el estado "missing" del panel médico.
 */
export async function countExpiringMedicalPlayers(
  today: string,
  cutoff: string,
): Promise<MedicalCertAlert> {
  const rows = await db.query.persons.findMany({
    where: and(isNotNull(persons.medicalCertUntil), lte(persons.medicalCertUntil, cutoff)),
    columns: { medicalCertUntil: true },
    with: {
      memberships: {
        columns: { role: true },
        with: {
          team: {
            columns: { category: true },
            with: { season: { columns: { isCurrent: true } } },
          },
        },
      },
    },
  });

  let expired = 0;
  let expiring = 0;
  for (const person of rows) {
    if (!isActivePlayer(person.memberships)) continue;
    // Por debajo de cadete no se exige certificado médico, no avisa.
    const requiresCheckup = person.memberships.some(
      (m) => m.team.season.isCurrent && categoryRequiresMedicalCheckup(m.team.category),
    );
    if (!requiresCheckup) continue;

    if (person.medicalCertUntil! < today) expired++;
    else expiring++;
  }

  return { expired, expiring, total: expired + expiring };
}
