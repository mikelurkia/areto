import "server-only";

import { and, asc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { persons } from "@/db/schema";
import { isMinor } from "@/lib/age";
import { type PersonFilters, personWhere } from "@/lib/person-list";

/**
 * Los datos personales que piden fuera del club (federación, seguro, la
 * organización de un torneo): nombre, fecha de nacimiento, DNI, dirección y
 * una forma de contacto.
 *
 * Existe aparte de `person-list.ts` porque son dos consultas con distinta
 * forma: el listado necesita equipos, etiquetas y titulaciones para pintar la
 * tabla, y esta necesita el correo y el teléfono **del tutor**, que el listado
 * no usa. Compartir una sola consulta significaría subir a todas las páginas
 * del listado unos datos que solo hacen falta al exportar.
 *
 * Lo que sí se comparte es el `WHERE`: los filtros de la exportación son, por
 * definición, los que la persona tiene puestos en pantalla.
 */

/** Nombre del fichero, sin extensión: el CSV y el Excel comparten el mismo. */
export const CONTACT_EXPORT_BASENAME = "datos-contacto";

/** A quién se exporta: una selección explícita, o todo lo que casa con los filtros. */
export type ContactScope = { ids: readonly string[] } | { filters: PersonFilters };

type GuardianContact = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type ContactPerson = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationalId: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  guardians: GuardianContact[];
};

/**
 * Filas en crudo, ya ordenadas como saldrán en el fichero.
 *
 * Sin `limit`/`offset`: exportar significa "todo lo que casa", no la página
 * que se está viendo — el mismo criterio que `loadPersonRowsForExport`.
 */
export async function loadContactPersons(scope: ContactScope): Promise<ContactPerson[]> {
  // Una selección vacía no es "todas": es ninguna. Sin este corte,
  // `inArray(..., [])` genera un `WHERE false` que funciona, pero conviene
  // ahorrarse el viaje a la base de datos.
  if ("ids" in scope && scope.ids.length === 0) return [];

  const where =
    "ids" in scope
      ? inArray(persons.id, [...scope.ids])
      : and(personWhere(scope.filters));

  const rows = await db.query.persons.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      nationalId: true,
      address: true,
      postalCode: true,
      city: true,
      email: true,
      phone: true,
    },
    with: {
      guardianRows: {
        columns: {},
        with: {
          guardian: {
            columns: { firstName: true, lastName: true, email: true, phone: true },
          },
        },
        // El tutor principal primero: es el que manda cuando hay varios.
        orderBy: (g, { desc }) => [desc(g.isPrimary)],
      },
    },
    where,
    orderBy: [asc(persons.lastName), asc(persons.firstName)],
  });

  return rows.map(({ guardianRows, ...person }) => ({
    ...person,
    guardians: guardianRows.map((r) => r.guardian),
  }));
}

/**
 * Correo y teléfono efectivos de una persona.
 *
 * Un menor rara vez tiene correo o teléfono propios, y quien recibe el fichero
 * necesita poder contactar igualmente: se rellenan con los del tutor
 * principal. Campo a campo e independientes — un menor puede tener móvil pero
 * no correo, y entonces solo se hereda el correo.
 *
 * De ahí que se devuelva **qué** se ha heredado y no un simple "sí/no": con un
 * único aviso genérico, una fila con correo propio y teléfono del tutor no
 * dejaría claro cuál de los dos es de quién, que es justo lo que la columna
 * tiene que evitar.
 */
export function resolveContactFields(person: {
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  guardians: readonly GuardianContact[];
}): {
  email: string;
  phone: string;
  guardianName: string;
  borrowedEmail: boolean;
  borrowedPhone: boolean;
} {
  const guardian = isMinor(person.birthDate) ? person.guardians[0] : undefined;

  const borrowedEmail = person.email === null && (guardian?.email ?? null) !== null;
  const borrowedPhone = person.phone === null && (guardian?.phone ?? null) !== null;

  return {
    email: person.email ?? guardian?.email ?? "",
    phone: person.phone ?? guardian?.phone ?? "",
    guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : "",
    borrowedEmail,
    borrowedPhone,
  };
}

/** Traductor del namespace `Personas`, tal y como lo devuelven `useTranslations` y `getTranslations`. */
type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * Cabeceras y celdas del fichero. Una sola función para los dos formatos: así
 * el CSV y el Excel no pueden acabar con columnas distintas.
 *
 * La fecha va en ISO crudo y no formateada, como el resto de exportaciones del
 * proyecto: es lo que otros programas saben leer sin ambigüedad de idioma.
 */
export function buildContactExport(
  people: readonly ContactPerson[],
  t: Translate,
): { headers: string[]; rows: string[][] } {
  const headers = [
    t("contactColFirstName"),
    t("contactColLastName"),
    t("contactColBirthDate"),
    t("contactColNationalId"),
    t("contactColAddress"),
    t("contactColPostalCode"),
    t("contactColCity"),
    t("contactColEmail"),
    t("contactColPhone"),
    t("contactColContactOf"),
  ];

  const rows = people.map((person) => {
    const { email, phone, guardianName, borrowedEmail, borrowedPhone } =
      resolveContactFields(person);

    // "Ane Zabala (teléfono)" y no solo "Ane Zabala": la columna dice de quién
    // es el dato prestado y también cuál de los dos lo es.
    const contactOf =
      borrowedEmail && borrowedPhone
        ? t("contactOfBoth", { name: guardianName })
        : borrowedEmail
          ? t("contactOfEmail", { name: guardianName })
          : borrowedPhone
            ? t("contactOfPhone", { name: guardianName })
            : "";

    return [
      person.firstName,
      person.lastName,
      person.birthDate ?? "",
      person.nationalId ?? "",
      person.address ?? "",
      person.postalCode ?? "",
      person.city ?? "",
      email,
      phone,
      contactOf,
    ];
  });

  return { headers, rows };
}
