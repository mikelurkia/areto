/**
 * Orden canónico de la plantilla, compartido por cualquier listado de
 * membresías de un equipo. Puro (sin React), como `roster-health`.
 *
 * Primero el cuerpo técnico (entrenador, luego staff) y después los jugadores
 * agrupados por puesto de futsal, de la portería hacia arriba:
 * portero → cierre → ala → pívot.
 */
type OrderMembership = {
  role: string;
  positions: string[];
  jerseyNumber: number | null;
};

const ROLE_ORDER = ["coach", "staff", "player"];
const POSITION_ORDER = ["portero", "cierre", "ala", "pivot"];

/** Los valores desconocidos van al final, en vez de colarse en cabeza. */
const rankIn = (order: string[], value: string) => {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
};

/**
 * Un jugador puede tener varios puestos marcados; manda el más defensivo, que
 * es el que define dónde juega habitualmente.
 */
const positionRank = (positions: string[]) =>
  positions.length === 0
    ? POSITION_ORDER.length
    : Math.min(...positions.map((pos) => rankIn(POSITION_ORDER, pos)));

export function compareRosterMembers(a: OrderMembership, b: OrderMembership) {
  const byRole = rankIn(ROLE_ORDER, a.role) - rankIn(ROLE_ORDER, b.role);
  if (byRole !== 0) return byRole;

  const byPosition = positionRank(a.positions) - positionRank(b.positions);
  if (byPosition !== 0) return byPosition;

  // Dentro del mismo grupo, por dorsal; los que no tienen, al final.
  const jerseyRank = (n: number | null) => n ?? Number.MAX_SAFE_INTEGER;
  return jerseyRank(a.jerseyNumber) - jerseyRank(b.jerseyNumber);
}

/** Devuelve una copia ordenada: no muta la lista recibida. */
export function sortRoster<T extends OrderMembership>(items: readonly T[]): T[] {
  return [...items].sort(compareRosterMembers);
}
