import "server-only";

import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { asc, sql } from "drizzle-orm";

import { db } from "@/db";
import { clubSettings, federationAccounts } from "@/db/schema";

export type ClubSettings = typeof clubSettings.$inferSelect;
export type FederationAccount = typeof federationAccounts.$inferSelect;

/** Etiqueta de caché de los datos del club; la invalida `updateClubSettings`. */
export const CLUB_SETTINGS_TAG = "club-settings";

/**
 * Datos del club como emisor de facturas. Tabla singleton: devolvemos la
 * primera (y única) fila, o `null` si aún no se han configurado.
 *
 * Cacheada con `use cache`: no depende del usuario ni de la petición, la piden
 * varias vistas (facturas, recibos, carnés, muro público) y cambia como mucho
 * una vez al año. Al estar cacheada puede formar parte del armazón estático en
 * lugar de bloquear el render. `updateClubSettings` la invalida por etiqueta.
 */
export async function getClubSettings(): Promise<ClubSettings | null> {
  "use cache";
  cacheTag(CLUB_SETTINGS_TAG);
  cacheLife("max");

  const row = await db.query.clubSettings.findFirst();
  return row ?? null;
}

/**
 * Credenciales del club en las intranets de las federaciones (gipuzkoana,
 * vasca...), ordenadas por nombre. Solo lectura por ahora.
 */
export const getFederationAccounts = cache(
  async function getFederationAccounts(): Promise<FederationAccount[]> {
    return db.query.federationAccounts.findMany({
      orderBy: [asc(federationAccounts.name)],
    });
  },
);

/** ¿Hay datos fiscales mínimos para emitir una factura? */
export function hasIssuerData(settings: ClubSettings | null): boolean {
  return Boolean(settings?.legalName && settings?.taxId);
}

/**
 * Reserva el siguiente número de factura del año, de forma atómica y sin
 * huecos, y lo devuelve ya formateado como `2026/0001`. El UPSERT bloquea la
 * fila del año durante el incremento, así que dos emisiones simultáneas nunca
 * obtienen el mismo número.
 */
export async function nextInvoiceNumber(year: number): Promise<string> {
  const rows = await db.execute<{ last_number: number }>(sql`
    INSERT INTO invoice_counters (year, last_number)
    VALUES (${year}, 1)
    ON CONFLICT (year)
    DO UPDATE SET last_number = invoice_counters.last_number + 1
    RETURNING last_number
  `);
  const n = Number(rows[0]?.last_number ?? 1);
  return `${year}/${String(n).padStart(4, "0")}`;
}
