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
