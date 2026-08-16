/** Etiqueta de un equipo con su temporada, para selects/listados: "Senior A · 2025/26". */
export function teamSeasonLabel(team: { name: string }, season: { name: string }): string {
  return `${team.name} · ${season.name}`;
}
