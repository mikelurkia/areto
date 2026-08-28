import "server-only";

import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { asc, sql } from "drizzle-orm";

import { db } from "@/db";
import { clubSettings, federationAccounts } from "@/db/schema";
import { fileExists, getSignedUrl } from "@/lib/supabase/storage";

export type ClubSettings = typeof clubSettings.$inferSelect;
export type FederationAccount = typeof federationAccounts.$inferSelect;

/** Etiqueta de caché de los datos del club; la invalidan las acciones de club (`club/actions.ts`). */
export const CLUB_SETTINGS_TAG = "club-settings";

/**
 * Bucket privado de documentos y gráficos propios del club: la plantilla del
 * parte de lesión (`injury-report-pdf.ts`) y el logo/sello/firma de más abajo.
 * Solo un club, así que no hace falta guardar sus rutas en `club_settings`:
 * son fijas, y basta con comprobar si el objeto existe (mismo patrón que la
 * plantilla del parte).
 */
export const DOCUMENT_TEMPLATES_BUCKET = "document-templates";
export const CLUB_LOGO_PATH = "club/logo.webp";
export const CLUB_SEAL_PATH = "club/sello.png";
export const CLUB_SIGNATURE_PATH = "club/firma.png";

export type ClubBrandingAssets = {
  logoUrl: string | null;
  sealUrl: string | null;
  signatureUrl: string | null;
};

/**
 * URLs del logo del club, su sello y la firma del directivo, o `null` cada
 * una si no se ha subido.
 *
 * Sin `"use cache"`, a diferencia de `getClubSettings`: `fileExists` mira el
 * bucket con el cliente de sesión (`createClient`, que lee `cookies()` para
 * las políticas RLS de Storage), y Cache Components no deja acceder a fuentes
 * dinámicas como cookies dentro de un ámbito cacheado. Mismo patrón sin
 * cachear que ya usaba la comprobación de la plantilla del parte de lesión.
 */
export async function getClubBrandingAssets(): Promise<ClubBrandingAssets> {
  const [hasLogo, hasSeal, hasSignature] = await Promise.all([
    fileExists(DOCUMENT_TEMPLATES_BUCKET, CLUB_LOGO_PATH),
    fileExists(DOCUMENT_TEMPLATES_BUCKET, CLUB_SEAL_PATH),
    fileExists(DOCUMENT_TEMPLATES_BUCKET, CLUB_SIGNATURE_PATH),
  ]);
  const [logoUrl, sealUrl, signatureUrl] = await Promise.all([
    hasLogo ? getSignedUrl(DOCUMENT_TEMPLATES_BUCKET, CLUB_LOGO_PATH) : Promise.resolve(null),
    hasSeal ? getSignedUrl(DOCUMENT_TEMPLATES_BUCKET, CLUB_SEAL_PATH) : Promise.resolve(null),
    hasSignature
      ? getSignedUrl(DOCUMENT_TEMPLATES_BUCKET, CLUB_SIGNATURE_PATH)
      : Promise.resolve(null),
  ]);
  return { logoUrl, sealUrl, signatureUrl };
}

/**
 * Datos del club como emisor de facturas. Tabla singleton: devolvemos la
 * primera (y única) fila, o `null` si aún no se han configurado.
 *
 * Cacheada con `use cache`: no depende del usuario ni de la petición, la piden
 * varias vistas (facturas, recibos, carnés, muro público) y cambia como mucho
 * una vez al año. Al estar cacheada puede formar parte del armazón estático en
 * lugar de bloquear el render. Las acciones de club la invalidan por etiqueta.
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
