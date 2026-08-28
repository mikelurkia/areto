import "server-only";

import { and, asc, count, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons } from "@/db/schema";
import { likePattern } from "@/lib/sql-text";

/**
 * El listado de socios activos, resuelto en la base de datos — mismo patrón
 * que `src/lib/person-list.ts` para `/personas`: antes `/socios` traía la
 * tabla `persons` entera y filtraba en memoria, así que el payload crecía con
 * el tamaño del club y no con lo que se ve en pantalla. Ahora la búsqueda
 * viaja en la URL, se traduce a `WHERE` y solo suben las filas de la página.
 */

export const MEMBER_PAGE_SIZE = 25;

export type MemberFilters = {
  q: string;
  page: number;
};

export function parseMemberFilters(
  searchParams: Record<string, string | string[] | undefined>,
): MemberFilters {
  const one = (key: string) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const page = Number(one("pagina"));
  return {
    q: one("q").trim(),
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/** Distingue "el club no tiene socios" de "esta búsqueda no devuelve nada". */
export function hasActiveMemberFilters(filters: MemberFilters): boolean {
  return filters.q !== "";
}

const isActiveMember = sql`exists (
    select 1 from club_members cm
    where cm.person_id = ${persons.id} and cm.status = 'active'
  )`;

function memberWhere(filters: MemberFilters) {
  const parts: (ReturnType<typeof sql> | undefined)[] = [isActiveMember];

  if (filters.q) {
    const pattern = likePattern(filters.q);
    parts.push(
      or(
        ilike(persons.firstName, pattern),
        ilike(persons.lastName, pattern),
        ilike(sql`${persons.firstName} || ' ' || ${persons.lastName}`, pattern),
        ilike(persons.email, pattern),
        ilike(persons.phone, pattern),
      ),
    );
  }

  return and(...parts);
}

function loadRows(where: ReturnType<typeof memberWhere>, page?: number) {
  return db.query.persons.findMany({
    columns: { id: true, firstName: true, lastName: true, email: true, phone: true },
    with: { clubMember: { columns: { memberNumber: true, joinedAt: true } } },
    where,
    orderBy: [asc(persons.lastName), asc(persons.firstName)],
    ...(page === undefined
      ? {}
      : { limit: MEMBER_PAGE_SIZE, offset: (page - 1) * MEMBER_PAGE_SIZE }),
  });
}

type RawMember = Awaited<ReturnType<typeof loadRows>>[number];

export type MemberRow = ReturnType<typeof toRow>;

function toRow(p: RawMember) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    memberNumber: p.clubMember?.memberNumber ?? null,
    joinedAt: p.clubMember?.joinedAt ?? "",
  };
}

export type MemberPage = {
  rows: MemberRow[];
  total: number;
  pageCount: number;
  page: number;
};

export async function loadMemberPage(filters: MemberFilters): Promise<MemberPage> {
  const where = memberWhere(filters);

  const [{ total }] = await db.select({ total: count() }).from(persons).where(where);

  const pageCount = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE));
  // La página viene de la URL: se acota al número real de páginas, igual que
  // hace `/personas`.
  const page = Math.min(filters.page, pageCount);
  const rows = total === 0 ? [] : await loadRows(where, page);

  return { rows: rows.map(toRow), total, pageCount, page };
}

/**
 * Todas las filas que casan con la búsqueda, sin paginar. Solo para la
 * exportación a CSV, que siempre significó "lo que estoy viendo filtrado" y
 * no "la página actual".
 */
export async function loadMemberRowsForExport(filters: MemberFilters): Promise<MemberRow[]> {
  const rows = await loadRows(memberWhere(filters));
  return rows.map(toRow);
}
