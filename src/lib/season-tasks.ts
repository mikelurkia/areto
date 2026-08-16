import type { seasonTaskKind, seasonTaskStatus } from "@/db/schema";

/**
 * Lógica pura (sin React) de los trámites de temporada, compartida entre la
 * página, las server actions y el dashboard.
 */

export type SeasonTaskKind = (typeof seasonTaskKind.enumValues)[number];
export type SeasonTaskStatus = (typeof seasonTaskStatus.enumValues)[number];

/** Metadatos estáticos de cada tipo de trámite. */
export const SEASON_TASK_KINDS: Record<
  SeasonTaskKind,
  {
    /** ¿El trámite es por equipo (necesita `teamId`) o de club? */
    grain: "team" | "club";
    /** ¿Lleva importe + justificante de pago a la federación? */
    hasPayment: boolean;
    /** ¿Es el paraguas que agrega la inscripción de jugadores por equipo? */
    rollsUpPlayers: boolean;
  }
> = {
  inscripcion_liga: { grain: "team", hasPayment: true, rollsUpPlayers: false },
  inscripcion_copa: { grain: "team", hasPayment: true, rollsUpPlayers: false },
  alta_equipo_plataforma: { grain: "team", hasPayment: false, rollsUpPlayers: false },
  alta_jugadores_plataforma: { grain: "team", hasPayment: false, rollsUpPlayers: true },
  otro: { grain: "club", hasPayment: true, rollsUpPlayers: false },
};

/** Categorías de equipo que disputan copa (el resto solo liga). */
export const CUP_CATEGORIES = ["juvenil", "senior"] as const;

/**
 * Plantilla de arranque de temporada: qué trámites se generan y para qué
 * equipos. `generateSeasonTasks` la instancia; `sortOrder` fija el orden de
 * presentación. Los títulos se traducen en la UI a partir de `kind`, así que
 * aquí no hay texto: la plantilla es solo estructura.
 */
type TemplateEntry = {
  kind: SeasonTaskKind;
  /**
   * Filtro de equipos al que aplica la entrada:
   * - "all": un trámite por cada equipo de la temporada.
   * - "cup": solo equipos de categoría de copa (juvenil/senior).
   */
  scope: "all" | "cup";
};

export const SEASON_TASK_TEMPLATE: readonly TemplateEntry[] = [
  { kind: "inscripcion_liga", scope: "all" },
  { kind: "inscripcion_copa", scope: "cup" },
  { kind: "alta_equipo_plataforma", scope: "all" },
  { kind: "alta_jugadores_plataforma", scope: "all" },
];

/** ¿Una categoría de equipo disputa copa? (categoría nula = no, por prudencia). */
export function playsCup(category: string | null): boolean {
  return category !== null && (CUP_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Expande la plantilla a filas concretas para los equipos dados. Devuelve, por
 * cada trámite, el `kind`, el `teamId` y el `sortOrder`. No decide títulos ni
 * toca la base de datos: el llamador (server action) añade `seasonId`, título
 * traducido y hace el insert idempotente (saltando los que ya existan).
 */
export function expandTemplate(
  teams: { id: string; category: string | null }[],
): { kind: SeasonTaskKind; teamId: string; sortOrder: number }[] {
  const rows: { kind: SeasonTaskKind; teamId: string; sortOrder: number }[] = [];
  let order = 0;
  for (const entry of SEASON_TASK_TEMPLATE) {
    for (const team of teams) {
      if (entry.scope === "cup" && !playsCup(team.category)) continue;
      rows.push({ kind: entry.kind, teamId: team.id, sortOrder: order++ });
    }
  }
  return rows;
}

export type SeasonTaskProgress = {
  total: number;
  done: number;
  /** Trámites con pago cuyo importe aún no consta pagado (paidOn nulo). */
  unpaid: number;
  /** Suma de importes pendientes de pago, en céntimos. */
  unpaidCents: number;
};

/** Resumen de progreso de una lista de trámites (para la barra y el dashboard). */
export function computeSeasonTaskProgress(
  tasks: {
    kind: SeasonTaskKind;
    status: SeasonTaskStatus;
    amountCents: number | null;
    paidOn: string | null;
  }[],
): SeasonTaskProgress {
  let done = 0;
  let unpaid = 0;
  let unpaidCents = 0;
  for (const task of tasks) {
    if (task.status === "done") done += 1;
    const hasPayment = SEASON_TASK_KINDS[task.kind].hasPayment && task.amountCents !== null;
    if (hasPayment && task.paidOn === null) {
      unpaid += 1;
      unpaidCents += task.amountCents ?? 0;
    }
  }
  return { total: tasks.length, done, unpaid, unpaidCents };
}

/** Rollup de inscripción de jugadores de un equipo: inscritos / total activos. */
export function computeFederationRollup(
  memberships: { role: string; active: boolean; federationRegistered: boolean }[],
): { registered: number; total: number } {
  const players = memberships.filter((m) => m.active && m.role === "player");
  return {
    registered: players.filter((m) => m.federationRegistered).length,
    total: players.length,
  };
}
