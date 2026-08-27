"use server";

import { requirePermission } from "@/lib/auth";
import {
  type GuardianCandidate,
  type PersonListRow,
  loadEmailsForPersons,
  loadPersonRowsForExport,
  parsePersonFilters,
  searchGuardianCandidates,
} from "@/lib/person-list";

/**
 * Lecturas que la pantalla de personas necesita bajo demanda, desde que el
 * listado se pagina en servidor y el navegador ya no tiene a todo el club en
 * memoria.
 *
 * Van en su propio fichero y no en `actions.ts` (1.372 líneas de mutaciones)
 * porque no mutan nada: solo leen, y su permiso es de lectura.
 */

/**
 * Filas para el CSV: TODAS las que casan con los filtros, no solo la página.
 * La exportación siempre significó "lo que estoy viendo filtrado", y con la
 * paginación en servidor eso ya no se puede resolver en el cliente.
 */
export async function exportPersonRows(
  searchParams: Record<string, string>,
): Promise<PersonListRow[]> {
  await requirePermission("personas.view");
  return loadPersonRowsForExport(parsePersonFilters(searchParams));
}

/**
 * Correos de la selección para el envío con copia oculta. La selección puede
 * abarcar varias páginas, así que se resuelve aquí.
 */
export async function emailsForSelection(ids: string[]): Promise<string[]> {
  await requirePermission("personas.view");
  return loadEmailsForPersons(ids);
}

/** Busca candidatos a tutor por nombre, para el diálogo de persona. */
export async function findGuardianCandidates(
  query: string,
  excludePersonId?: string,
): Promise<GuardianCandidate[]> {
  await requirePermission("personas.manage");
  return searchGuardianCandidates(query, excludePersonId);
}
