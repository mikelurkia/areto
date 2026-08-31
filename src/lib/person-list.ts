import "server-only";

import { and, asc, count, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons, seasons, teams } from "@/db/schema";
import { isPastMember } from "@/lib/membership";
import { likePattern, phoneDigitsMatch } from "@/lib/sql-text";
import { teamSeasonLabel } from "@/lib/team-label";

/**
 * El listado de personas, resuelto en la base de datos.
 *
 * Antes la página traía la tabla `persons` entera con seis relaciones anidadas,
 * la serializaba al navegador y allí se filtraba y se paginaba a 25 en un
 * `useMemo`. Con cien personas se notaba poco; el problema es que el payload
 * crecía con el tamaño del club y no con lo que se ve en pantalla.
 *
 * Ahora los filtros viajan en la URL, se traducen a `WHERE` y solo suben las 25
 * filas de la página. Las condiciones se escriben con `EXISTS` y no con `JOIN` a
 * propósito: un `JOIN` a `memberships` multiplicaría las filas de `persons` y
 * obligaría a un `DISTINCT` que no se lleva bien con `LIMIT`.
 *
 * Los criterios son los mismos que aplicaba el cliente, incluida su limitación
 * conocida: `ILIKE '%…%'` no ignora acentos.
 */

export const PERSON_PAGE_SIZE = 25;

/** Ventana de "caduca pronto", la misma que usaba el filtro en cliente. */
const EXPIRY_WINDOW_DAYS = 30;

/** `interval` no acepta parámetro, así que el número va interpolado; es una constante del código, no entrada del usuario. */
const EXPIRY_WINDOW = sql.raw(`interval '${EXPIRY_WINDOW_DAYS} days'`);

export type PersonFilters = {
  q: string;
  team: string;
  role: string;
  expiry: string;
  docs: string;
  tag: string;
  page: number;
};

/**
 * Lee los filtros de la URL. Los nombres de parámetro son los que ya escribía
 * `useFilterParams`, así que los enlaces guardados siguen funcionando.
 */
export function parsePersonFilters(
  searchParams: Record<string, string | string[] | undefined>,
): PersonFilters {
  const one = (key: string) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const page = Number(one("pagina"));
  return {
    q: one("q").trim(),
    team: one("equipo") || "all",
    role: one("rol") || "all",
    expiry: one("caduca") || "all",
    docs: one("docs") || "all",
    tag: one("etiqueta") || "all",
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/**
 * ¿Hay algún filtro puesto? Sirve para distinguir "el club no tiene personas"
 * de "esta búsqueda no devuelve nada", que son dos mensajes distintos y antes
 * se resolvían mirando si la lista completa venía vacía.
 */
export function hasActiveFilters(filters: PersonFilters): boolean {
  return (
    filters.q !== "" ||
    filters.team !== "all" ||
    filters.role !== "all" ||
    filters.expiry !== "all" ||
    filters.docs !== "all" ||
    filters.tag !== "all"
  );
}

/** Tiene alguna membresía, en cualquier temporada. */
const hasAnyMembership = sql`exists (
    select 1 from memberships m where m.person_id = ${persons.id}
  )`;

/** Tiene membresía en la temporada activa. */
const hasCurrentMembership = sql`exists (
    select 1 from memberships m
    join teams t on t.id = m.team_id
    join seasons s on s.id = t.season_id
    where m.person_id = ${persons.id} and s.is_current
  )`;

/**
 * Quien tuvo equipo alguna vez pero ninguno en la temporada activa. Traducción
 * literal de `isPastMember` (`src/lib/membership.ts`); las dos versiones
 * conviven porque el render de la fila sigue necesitando la de TypeScript.
 */
const notPastMember = sql`not (${hasAnyMembership} and not ${hasCurrentMembership})`;

/** Mismo criterio que `isMinor`: menos de 18 años cumplidos hoy. */
const isMinorSql = sql`(
    ${persons.birthDate} is not null
    and ${persons.birthDate} > current_date - interval '18 years'
  )`;

/**
 * La condición `WHERE` que corresponde a los filtros. Exportada porque la
 * exportación de datos de contacto (`src/lib/contact-export.ts`) hace su
 * propia consulta —con otras columnas— pero tiene que respetar exactamente
 * los mismos filtros que la persona ve aplicados en pantalla.
 */
export function personWhere(filters: PersonFilters) {
  const parts: (ReturnType<typeof sql> | undefined)[] = [];

  if (filters.q) {
    const pattern = likePattern(filters.q);
    parts.push(
      or(
        ilike(persons.firstName, pattern),
        ilike(persons.lastName, pattern),
        ilike(sql`${persons.firstName} || ' ' || ${persons.lastName}`, pattern),
        ilike(persons.email, pattern),
        ilike(persons.nationalId, pattern),
        phoneDigitsMatch(persons.phone, filters.q),
      ),
    );
  }

  if (filters.team === "none") {
    parts.push(sql`not ${hasAnyMembership}`);
  } else if (filters.team !== "all") {
    parts.push(sql`exists (
      select 1 from memberships m
      where m.person_id = ${persons.id} and m.team_id = ${filters.team}::uuid
    )`);
  }

  if (filters.role === "member") {
    parts.push(sql`exists (
      select 1 from club_members cm
      where cm.person_id = ${persons.id} and cm.status = 'active'
    )`);
  } else if (filters.role === "player" || filters.role === "coach" || filters.role === "staff") {
    parts.push(sql`exists (
      select 1 from memberships m
      where m.person_id = ${persons.id} and m.role = ${filters.role}
    )`);
  } else if (filters.role === "guardian") {
    parts.push(sql`exists (
      select 1 from person_guardians pg where pg.guardian_id = ${persons.id}
    )`);
  } else if (filters.role === "minorWithoutGuardian") {
    parts.push(isMinorSql);
    parts.push(sql`not exists (
      select 1 from person_guardians pg where pg.person_id = ${persons.id}
    )`);
  }

  if (filters.expiry === "medical") {
    parts.push(notPastMember);
    parts.push(sql`${persons.medicalCertUntil} is not null`);
    parts.push(sql`${persons.medicalCertUntil} <= current_date + ${EXPIRY_WINDOW}`);
  } else if (filters.expiry === "qualification") {
    parts.push(notPastMember);
    parts.push(sql`exists (
      select 1 from person_qualifications pq
      where pq.person_id = ${persons.id}
        and pq.expires_on is not null
        and pq.expires_on <= current_date + ${EXPIRY_WINDOW}
    )`);
  }

  if (filters.docs === "pending") {
    parts.push(notPastMember);
    parts.push(sql`(
      not ${persons.photoConsent}
      or ${persons.medicalCertUntil} is null
      or ${persons.medicalCertUntil} < current_date
    )`);
  }

  if (filters.tag !== "all") {
    parts.push(sql`exists (
      select 1 from person_tags pt
      where pt.person_id = ${persons.id} and pt.tag = ${filters.tag}
    )`);
  }

  return parts.length > 0 ? and(...parts) : undefined;
}

/**
 * Una página del listado.
 *
 * Las columnas de `persons` van enumeradas porque la fila alimenta también el
 * diálogo de edición en línea: recortar más dejaría ese formulario sin campos.
 * Lo que ya no viaja son las cinco marcas de tiempo de consentimiento y el
 * resto de columnas que esta pantalla no lee.
 */
function loadRows(where: ReturnType<typeof personWhere>, page?: number) {
  return db.query.persons.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      nationalId: true,
      address: true,
      city: true,
      postalCode: true,
      iban: true,
      medicalCertUntil: true,
      shirtSize: true,
      pantsSize: true,
      shoeSize: true,
      photoConsent: true,
      sepaConsent: true,
      notes: true,
    },
    with: {
      guardianRows: {
        columns: {},
        with: { guardian: { columns: { id: true, firstName: true, lastName: true } } },
        orderBy: (g, { desc }) => [desc(g.isPrimary)],
      },
      guardianOfRows: { columns: { id: true } },
      clubMember: { columns: { status: true, memberNumber: true } },
      memberships: {
        columns: { teamId: true, role: true, jerseyNumber: true },
        with: {
          team: {
            columns: { name: true },
            with: { season: { columns: { isCurrent: true } } },
          },
        },
      },
      qualifications: { columns: { title: true, expiresOn: true } },
      tags: { columns: { tag: true } },
    },
    where,
    orderBy: [asc(persons.lastName), asc(persons.firstName)],
    ...(page === undefined
      ? {}
      : { limit: PERSON_PAGE_SIZE, offset: (page - 1) * PERSON_PAGE_SIZE }),
  });
}

type RawPerson = Awaited<ReturnType<typeof loadRows>>[number];

/** La fila tal y como la espera `PersonasBrowser`. */
export type PersonListRow = ReturnType<typeof toRow>;

function toRow(p: RawPerson) {
  const { clubMember, guardianRows, guardianOfRows, memberships, qualifications, tags, ...rest } =
    p;
  return {
    ...rest,
    isMember: clubMember?.status === "active",
    memberNumber: clubMember?.memberNumber ?? null,
    guardians: guardianRows.map((r) => ({
      id: r.guardian.id,
      firstName: r.guardian.firstName,
      lastName: r.guardian.lastName,
    })),
    memberships: memberships.map((m) => ({
      teamId: m.teamId,
      role: m.role,
      jerseyNumber: m.jerseyNumber,
      team: { name: m.team.name },
    })),
    qualifications: qualifications.map((q) => ({ title: q.title, expiresOn: q.expiresOn })),
    tags: tags.map((t) => t.tag),
    dependentsCount: guardianOfRows.length,
    isPastMember: isPastMember(memberships),
  };
}

export type PersonPage = {
  rows: PersonListRow[];
  total: number;
  pageCount: number;
  page: number;
};

export async function loadPersonPage(filters: PersonFilters): Promise<PersonPage> {
  const where = personWhere(filters);

  const [{ total }] = await db.select({ total: count() }).from(persons).where(where);

  const pageCount = Math.max(1, Math.ceil(total / PERSON_PAGE_SIZE));
  // La página viene de la URL: se acota al número real de páginas, igual que
  // hacía el cliente.
  const page = Math.min(filters.page, pageCount);
  const rows = total === 0 ? [] : await loadRows(where, page);

  return { rows: rows.map(toRow), total, pageCount, page };
}

/**
 * Todas las filas que casan con los filtros, sin paginar. Solo para la
 * exportación a CSV, que siempre significó "lo que estoy viendo filtrado" y no
 * "la página actual".
 */
export async function loadPersonRowsForExport(
  filters: PersonFilters,
): Promise<PersonListRow[]> {
  const rows = await loadRows(personWhere(filters));
  return rows.map(toRow);
}

/** Etiquetas existentes, para el desplegable del filtro. */
export async function loadPersonTagOptions(): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(
    sql`select distinct tag from person_tags order by tag`,
  );
  return rows.map((r) => r.tag);
}

/**
 * Equipos de la temporada activa, para el filtro y el alta masiva. En SQL en
 * vez de traer todos los equipos de la historia del club y quedarse con los de
 * `isCurrent` en memoria, que es lo que hacía la página.
 */
export async function loadCurrentTeamOptions(): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .select({ id: teams.id, name: teams.name, seasonName: seasons.name })
    .from(teams)
    .innerJoin(seasons, eq(seasons.id, teams.seasonId))
    .where(eq(seasons.isCurrent, true))
    .orderBy(asc(teams.category), asc(teams.name));
  return rows.map((team) => ({
    id: team.id,
    label: teamSeasonLabel(team, { name: team.seasonName }),
  }));
}

/**
 * Correos de las personas seleccionadas, para el envío masivo con copia oculta.
 * Hace falta en servidor porque la selección puede abarcar varias páginas y el
 * navegador ya no tiene en memoria a todo el club.
 */
export async function loadEmailsForPersons(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ email: persons.email })
    .from(persons)
    .where(and(inArray(persons.id, [...ids]), isNotNull(persons.email)));
  return [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e)))];
}

export type GuardianCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
};

const GUARDIAN_COLUMNS = {
  id: persons.id,
  firstName: persons.firstName,
  lastName: persons.lastName,
  birthDate: persons.birthDate,
};

/** Longitud mínima: con una letra la lista no dice nada y la consulta sí cuesta. */
const MIN_GUARDIAN_QUERY = 2;

/**
 * Candidatos a tutor, por búsqueda de nombre. La lista completa del club era la
 * otra razón por la que esta página cargaba la tabla entera: el diálogo de
 * persona recibía una copia de todas las personas solo para poblar un select.
 *
 * Excluye menores, que no pueden ser tutores, y al editar a la propia persona.
 */
export async function searchGuardianCandidates(
  query: string,
  excludePersonId?: string,
): Promise<GuardianCandidate[]> {
  const term = query.trim();
  if (term.length < MIN_GUARDIAN_QUERY) return [];
  const pattern = likePattern(term);
  return db
    .select(GUARDIAN_COLUMNS)
    .from(persons)
    .where(
      and(
        or(
          ilike(persons.firstName, pattern),
          ilike(persons.lastName, pattern),
          ilike(sql`${persons.firstName} || ' ' || ${persons.lastName}`, pattern),
        ),
        sql`not ${isMinorSql}`,
        excludePersonId ? sql`${persons.id} <> ${excludePersonId}::uuid` : undefined,
      ),
    )
    .orderBy(asc(persons.lastName), asc(persons.firstName))
    .limit(20);
}
