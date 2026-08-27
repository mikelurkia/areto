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
