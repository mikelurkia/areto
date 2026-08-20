type SeasonScopedMembership = { team: { season: { isCurrent: boolean } } };

/**
 * Alguien que tuvo equipo alguna vez pero ninguno en la temporada activa ya no
 * juega/trabaja en el club: no debe generar ruido de vencimientos ni aparecer
 * como jugador/entrenador/staff activo. Quien nunca tuvo equipo (patrocinador,
 * tutor sin ficha propia...) no se ve afectado.
 */
export function isPastMember(memberships: SeasonScopedMembership[]): boolean {
  return memberships.length > 0 && !memberships.some((m) => m.team.season.isCurrent);
}

type PlayerSeasonScopedMembership = SeasonScopedMembership & { role: string };

/**
 * Jugador con ficha en un equipo de la temporada activa. Más estricto que
 * `isPastMember`: además de exigir equipo en la temporada actual, exige que
 * el rol sea "player" (excluye entrenadores, staff y a quien no tiene ningún
 * equipo). Mismo criterio que `countMedicalCertMismatches` en
 * `data-integrity.ts`, para que el aviso de certificado médico del dashboard
 * y el de vencimientos próximos coincidan.
 */
export function isActivePlayer(memberships: PlayerSeasonScopedMembership[]): boolean {
  return memberships.some((m) => m.role === "player" && m.team.season.isCurrent);
}
