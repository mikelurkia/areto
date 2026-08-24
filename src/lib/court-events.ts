import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { courtEvents, memberships } from "@/db/schema";
import { hasPermission, type CurrentUser } from "@/lib/auth";

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
 * equipo `teamId`. Con `calendario.manage.all`, cualquier equipo; con
 * `calendario.manage` a secas, solo aquellos en los que consta como
 * entrenador. `teamId` puede ser `null` (fila sin equipo, pensada para futuros
 * kinds distintos de "match"): ahí hace falta `calendario.manage.all`.
 *
 * El ámbito (qué equipos son "los suyos") no es un permiso: es una relación con
 * los datos, vía `memberships`. Por eso sigue viviendo aquí y no en la matriz.
 */
export async function assertCourtEventAccess(
  user: CurrentUser,
  teamId: string | null,
): Promise<boolean> {
  if (hasPermission(user, "calendario.manage.all")) return true;
  if (!hasPermission(user, "calendario.manage") || !teamId) return false;
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

/** Agrupa eventos por la clave de fin de semana (sábado), reutilizable tanto
 * por la vista de lista como por la de mes. */
export function groupCourtEventsByWeekend<T extends { weekendOf: string }>(
  events: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const event of events) {
    const key = getWeekendKey(event.weekendOf);
    const group = groups.get(key);
    if (group) group.push(event);
    else groups.set(key, [event]);
  }
  return groups;
}

/** ¿Puede el usuario gestionar (editar/borrar) una petición del equipo
 * `teamId`? Versión sin acceso a BD de `assertCourtEventAccess`, para usar en
 * el render una vez resueltos `canManage`/`coachTeamIds`. */
export function canManageCourtEvent(
  teamId: string | null,
  opts: { canManage: boolean; coachTeamIds: Set<string> | null },
): boolean {
  if (opts.canManage) return true;
  if (!teamId || !opts.coachTeamIds) return false;
  return opts.coachTeamIds.has(teamId);
}

/**
 * ¿Debe mostrarse un partido como interactivo (editable/borrable)? Un
 * partido fuera de casa nunca lo es, para ningún rol: el club no gestiona el
 * horario de un campo ajeno.
 */
export function canEditCourtEventBadge(
  event: { teamId: string | null; isHome: boolean | null },
  opts: { canManage: boolean; coachTeamIds: Set<string> | null },
): boolean {
  if (event.isHome !== true) return false;
  return canManageCourtEvent(event.teamId, opts);
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
