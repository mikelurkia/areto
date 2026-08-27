"use server";

import { ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons, teams } from "@/db/schema";
import { hasPermission, requireUser } from "@/lib/auth";
import { likePattern } from "@/lib/sql-text";

export type SearchResult = {
  type: "person" | "team";
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
};

/** Longitud mínima: con una letra la lista no dice nada y la consulta sí cuesta. */
const MIN_QUERY_LENGTH = 2;

/**
 * Búsqueda global de la paleta de comandos.
 *
 * Cada bloque de resultados va condicionado a su permiso de lectura, igual que
 * las secciones del menú: quien no puede entrar en Personas tampoco encuentra
 * personas aquí.
 *
 * Sin índice de texto a propósito: un club maneja cientos de filas, no millones,
 * y un `ILIKE '%…%'` no aprovecharía un índice B-tree de todos modos —haría
 * falta `pg_trgm`—. Tampoco ignora acentos, misma limitación que el filtro de
 * la pantalla de personas.
 */
export async function searchEntities(query: string): Promise<SearchResult[]> {
  const user = await requireUser();
  const term = query.trim();
  if (term.length < MIN_QUERY_LENGTH) return [];

  const pattern = likePattern(term);
  const canPersons = hasPermission(user, "personas.view");
  const canTeams = hasPermission(user, "equipos.view");

  const [people, teamRows] = await Promise.all([
    canPersons
      ? db.query.persons.findMany({
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            nationalId: true,
          },
          where: or(
            ilike(persons.firstName, pattern),
            ilike(persons.lastName, pattern),
            ilike(sql`${persons.firstName} || ' ' || ${persons.lastName}`, pattern),
            ilike(persons.nationalId, pattern),
          ),
          orderBy: (p, { asc }) => [asc(p.lastName), asc(p.firstName)],
          limit: 8,
        })
      : [],
    canTeams
      ? db.query.teams.findMany({
          columns: { id: true, name: true },
          with: { season: { columns: { name: true } } },
          where: ilike(teams.name, pattern),
          orderBy: (t, { asc }) => [asc(t.name)],
          limit: 5,
        })
      : [],
  ]);

  return [
    ...people.map((person) => ({
      type: "person" as const,
      id: person.id,
      label: `${person.firstName} ${person.lastName}`,
      sublabel: person.email ?? person.nationalId,
      href: `/personas/${person.id}`,
    })),
    ...teamRows.map((team) => ({
      type: "team" as const,
      id: team.id,
      label: team.name,
      sublabel: team.season?.name ?? null,
      href: `/equipos/${team.id}`,
    })),
  ];
}
