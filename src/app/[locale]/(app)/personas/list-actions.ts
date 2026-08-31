"use server";

import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/lib/auth";
import {
  CONTACT_EXPORT_BASENAME,
  buildContactExport,
  loadContactPersons,
} from "@/lib/contact-export";
import {
  type GuardianCandidate,
  type PersonListRow,
  loadEmailsForPersons,
  loadPersonRowsForExport,
  parsePersonFilters,
  searchGuardianCandidates,
} from "@/lib/person-list";

/**
 * A quién exporta la pantalla: la selección de la tabla (que puede abarcar
 * varias páginas) o todo lo que casa con los filtros de la URL. Los filtros
 * viajan como los `searchParams` en crudo porque es lo que el navegador tiene
 * a mano; se parsean aquí, en servidor.
 */
type ContactActionScope =
  | { ids: string[] }
  | { searchParams: Record<string, string> };

function toContactScope(scope: ContactActionScope) {
  return "ids" in scope
    ? { ids: scope.ids }
    : { filters: parsePersonFilters(scope.searchParams) };
}

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

/**
 * Datos de contacto para mandar fuera del club, en CSV.
 *
 * El ámbito es explícito y no implícito: o unas personas concretas (la
 * selección de la tabla, que puede abarcar varias páginas) o todo lo que casa
 * con los filtros de la URL. Devuelve cabeceras y celdas ya construidas para
 * que `downloadCsv` no tenga que saber nada de las columnas.
 */
export async function exportContactRows(
  scope: ContactActionScope,
): Promise<{ filename: string; headers: string[]; rows: string[][] }> {
  await requirePermission("personas.view");
  const t = await getTranslations("Personas");
  const { headers, rows } = buildContactExport(
    await loadContactPersons(toContactScope(scope)),
    t,
  );
  return { filename: CONTACT_EXPORT_BASENAME, headers, rows };
}
