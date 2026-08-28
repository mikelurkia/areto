import { or, sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * `%` y `_` son comodines de LIKE; escritos por el usuario son literales.
 *
 * Vive aquí y no junto a quien lo usaba primero (`search-actions.ts`) porque
 * ese fichero es `"use server"`: todo lo que exporta se convierte en Server
 * Action, así que no puede compartir un ayudante puro.
 */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Dígitos mínimos para buscar por teléfono: con uno o dos, el patrón aparece
 * dentro de casi cualquier número y la lista deja de decir nada.
 */
const MIN_PHONE_DIGITS = 3;

/**
 * Condición para buscar un teléfono ignorando cómo esté escrito.
 *
 * Los teléfonos se guardan tal cual los teclea quien rellena la ficha:
 * `666 12 34 56`, `666-123-456`, `+34 666123456`… Un `ILIKE` sobre la columna
 * solo encuentra los que coinciden carácter a carácter, así que aquí se
 * comparan solo los dígitos de ambos lados.
 *
 * El prefijo internacional se contempla en un único sentido —el guardado con
 * `+34` aparece igualmente al buscar el número nacional, porque `34666…`
 * contiene `666…`—, y en el contrario se prueba también sin él.
 *
 * Devuelve `undefined` cuando la consulta no trae dígitos suficientes, para
 * poder encadenarlo en un `or(...)` sin condicionales alrededor.
 */
export function phoneDigitsMatch(column: AnyColumn, query: string): SQL | undefined {
  const digits = query.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return undefined;

  const national = digits.replace(/^(?:00)?34/, "");
  const patterns = national !== digits && national.length >= MIN_PHONE_DIGITS
    ? [digits, national]
    : [digits];

  const normalized = sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')`;
  return or(...patterns.map((value) => sql`${normalized} like ${`%${value}%`}`));
}
