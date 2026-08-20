import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { courtEvents, memberships } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";

/** Equipos donde una persona consta como entrenador (en cualquier temporada
 * que tenga equipos con membership; en la práctica, la temporada activa). */
export async function getCoachTeamIds(personId: string | null): Promise<Set<string>> {
  if (!personId) return new Set();
  const rows = await db.query.memberships.findMany({
    where: and(eq(memberships.personId, personId), eq(memberships.role, "coach")),
    columns: { teamId: true },
  });
  return new Set(rows.map((r) => r.teamId));
}

/**
 * Puede el usuario dar de alta/editar/borrar una petición de horario del
 * equipo `teamId`. Admin/staff, cualquier equipo; un entrenador, solo el
 * suyo (o los suyos). `teamId` puede ser `null` (fila sin equipo, pensada
 * para futuros kinds distintos de "match"): ahí solo admin/staff pueden.
 */
export async function assertCourtEventAccess(
  user: CurrentUser,
  teamId: string | null,
): Promise<boolean> {
  if (user.role === "admin" || user.role === "staff") return true;
  if (user.role !== "coach" || !teamId) return false;
  const coachTeamIds = await getCoachTeamIds(user.personId);
  return coachTeamIds.has(teamId);
}

/**
 * Normaliza cualquier fecha del fin de semana (sábado o domingo) al sábado de
 * esa misma semana, para poder agrupar partidos aunque se haya tecleado el
 * domingo. Fechas entre semana (por si acaso) avanzan al sábado siguiente.
 */
export function getWeekendKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = domingo ... 6 = sábado
  const diffToSaturday = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  d.setDate(d.getDate() + diffToSaturday);
  return d.toISOString().slice(0, 10);
}

export async function loadCourtEvents({
  from,
  to,
  teamId,
}: {
  from: string;
  to: string;
  teamId?: string;
}) {
  return db.query.courtEvents.findMany({
    where: and(
      gte(courtEvents.weekendOf, from),
      lte(courtEvents.weekendOf, to),
      teamId ? eq(courtEvents.teamId, teamId) : undefined,
    ),
    with: { team: true },
    orderBy: (ce, { asc }) => [asc(ce.weekendOf)],
  });
}
