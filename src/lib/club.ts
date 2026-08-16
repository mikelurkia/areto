import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { clubSettings } from "@/db/schema";

export type ClubSettings = typeof clubSettings.$inferSelect;

/**
 * Datos del club como emisor de facturas. Tabla singleton: devolvemos la
 * primera (y única) fila, o `null` si aún no se han configurado.
 */
export async function getClubSettings(): Promise<ClubSettings | null> {
  const row = await db.query.clubSettings.findFirst();
  return row ?? null;
}

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
