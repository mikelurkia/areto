import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { registrations } from "@/db/schema";

export type MonthlyRegistrationTrendPoint = { month: string; count: number };

/**
 * Inscripciones por mes de la temporada (jugador y socio juntos), para el
 * mini-gráfico del dashboard. `month` en formato `YYYY-MM`, orden
 * cronológico. Deliberadamente sin `"use cache"`: cuenta solicitudes
 * recientes, mismo criterio que el resto de `dashboard-alerts.ts`.
 */
export async function loadMonthlyRegistrationTrend(
  seasonId: string,
): Promise<MonthlyRegistrationTrendPoint[]> {
  const monthExpr = sql`to_char(${registrations.createdAt}, 'YYYY-MM')`;

  const rows = await db
    .select({
      month: monthExpr.as("month"),
      total: sql<number>`count(*)::int`,
    })
    .from(registrations)
    .where(eq(registrations.seasonId, seasonId))
    .groupBy(monthExpr)
    .orderBy(monthExpr);

  return rows.map((r) => ({ month: r.month as string, count: r.total }));
}
