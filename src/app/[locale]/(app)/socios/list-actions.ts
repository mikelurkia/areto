"use server";

import { requirePermission } from "@/lib/auth";
import { type MemberRow, loadMemberRowsForExport, parseMemberFilters } from "@/lib/member-list";
import { loadEmailsForPersons } from "@/lib/person-list";

/**
 * Lecturas que la pantalla de socios necesita bajo demanda, desde que el
 * listado se pagina en servidor y el navegador ya no tiene a todo el club en
 * memoria. Mismo patrón que `personas/list-actions.ts`.
 */

/**
 * Filas para el CSV: TODAS las que casan con la búsqueda, no solo la página.
 */
export async function exportMemberRows(
  searchParams: Record<string, string>,
): Promise<MemberRow[]> {
  await requirePermission("socios.view");
  return loadMemberRowsForExport(parseMemberFilters(searchParams));
}

/**
 * Correos de la selección para el envío con copia oculta. La selección puede
 * abarcar varias páginas, así que se resuelve aquí.
 */
export async function emailsForMemberSelection(ids: string[]): Promise<string[]> {
  await requirePermission("socios.view");
  return loadEmailsForPersons(ids);
}
