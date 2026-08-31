import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { loadContactPersons, resolveContactFields } from "@/lib/contact-export";
import { parsePersonFilters } from "@/lib/person-list";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { PrintableSheet } from "@/components/printable-sheet";
import { PrintableSheetBodySkeleton } from "@/components/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Los mismos datos de contacto que descargan el CSV y el Excel, en papel.
 *
 * A veces lo que hace falta no es un fichero para otro programa sino una hoja
 * que llevarse: el listado para la mesa del torneo, la copia que firma quien
 * la recibe. Comparte `resolveContactFields` con la exportación, así que la
 * regla del tutor es exactamente la misma; lo que cambia es el reparto en
 * columnas, porque diez no caben legibles en un A4 y en pantalla sí.
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** Sin dato, una raya: igual que el acta federativa y el listado médico. */
const EMPTY = "—";

function firstValue(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * El documento. Aparte de la página para poder darle su `<Suspense>`: lee los
 * filtros de la URL y el reloj (la regla del tutor depende de quién es menor
 * *hoy*), así que no se puede prerenderizar.
 */
async function ContactListDocument({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<SearchParams>;
}) {
  // Marca el componente como de tiempo de petición antes de leer el reloj
  // (ver `next-prerender-current-time`).
  await connection();

  const params = await searchParams;
  const ids = firstValue(params, "ids")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  // Con `?ids=` manda la selección; si no, los mismos filtros del listado.
  const [people, club, t] = await Promise.all([
    loadContactPersons(
      ids.length > 0 ? { ids } : { filters: parsePersonFilters(params) },
    ),
    getClubSettings(),
    getTranslations("Personas"),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <PrintableSheet>
      <div className="flex items-start justify-between gap-6 border-b pb-[9pt]">
        <div>
          <h1 className="text-[11pt] font-semibold tracking-tight">
            {t("contactPrintTitle")}
          </h1>
          <p className="text-[8pt] text-muted-foreground">
            {club?.legalName ?? "Areto"}
          </p>
        </div>
        <div className="text-right text-[8pt]">
          <p className="font-medium">
            {t("contactPrintCount", { count: people.length })}
          </p>
          <p className="mt-1 text-[7pt] text-muted-foreground">
            {t("contactPrintGeneratedOn", { date: dateFmt.format(new Date()) })}
          </p>
        </div>
      </div>

      {people.length === 0 ? (
        <p className="text-[8pt] text-muted-foreground">{t("contactExportEmpty")}</p>
      ) : (
        /* Siete columnas y no las diez del fichero: en papel, la dirección va
           entera en una celda y el nombre en otra. `table-fixed` con anchos
           explícitos porque, al reparto automático, «dirección» y «correo» se
           comen el resto. Solo el DNI y la fecha llevan `nowrap`: son atómicos
           y partirlos no ayuda a nadie. */
        <Table className="table-fixed text-[8pt] [&_td]:px-[3pt] [&_td]:py-[1.5pt] [&_th]:px-[3pt] [&_th]:py-[1.5pt] [&_th]:break-words">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[19%]">{t("contactColName")}</TableHead>
              <TableHead className="w-[10%]">{t("contactColBirthDate")}</TableHead>
              <TableHead className="w-[11%]">{t("contactColNationalId")}</TableHead>
              <TableHead className="w-[22%]">{t("contactColAddress")}</TableHead>
              <TableHead className="w-[19%]">{t("contactColEmail")}</TableHead>
              <TableHead className="w-[10%]">{t("contactColPhone")}</TableHead>
              <TableHead className="w-[9%]">{t("contactColContactOf")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => {
              const { email, phone, guardianName, borrowedEmail, borrowedPhone } =
                resolveContactFields(person);

              // En papel no cabe "(correo y teléfono)": el asterisco marca el
              // dato prestado en su propia celda y el nombre va una sola vez.
              const mark = (borrowed: boolean, value: string) =>
                value === "" ? EMPTY : borrowed ? `${value} *` : value;

              const address = [
                person.address,
                [person.postalCode, person.city].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <TableRow key={person.id}>
                  <TableCell className="align-top font-medium">
                    {person.lastName}, {person.firstName}
                  </TableCell>
                  <TableCell nowrap className="align-top">
                    {person.birthDate
                      ? dateFmt.format(new Date(person.birthDate))
                      : EMPTY}
                  </TableCell>
                  <TableCell nowrap className="align-top">
                    {person.nationalId ?? EMPTY}
                  </TableCell>
                  <TableCell className="align-top">{address || EMPTY}</TableCell>
                  <TableCell className="align-top break-all">
                    {mark(borrowedEmail, email)}
                  </TableCell>
                  <TableCell className="align-top">{mark(borrowedPhone, phone)}</TableCell>
                  <TableCell className="align-top">{guardianName || EMPTY}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <p className="mt-auto pt-[9pt] text-[7pt] text-muted-foreground">
        {t("contactPrintGuardianNote")}
      </p>
    </PrintableSheet>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("personasContactos") };
}

export default async function ContactosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  // Renderizado estático de la envoltura: fija el idioma sin leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("personas.view");
  const t = await getTranslations("Personas");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href="/personas" label={t("contactPrintBack")} />
        <PrintButton label={t("contactPrintAction")} />
      </div>

      <Suspense
        fallback={
          <PrintableSheet>
            {/* Mismo relleno que el `loading.tsx`: un parpadeo, no dos. */}
            <PrintableSheetBodySkeleton lines={20} />
          </PrintableSheet>
        }
      >
        <ContactListDocument locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
