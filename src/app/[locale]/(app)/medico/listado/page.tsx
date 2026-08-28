import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import {
  filterMedicalPanelRows,
  medicalPanelRowRoles,
  medicalReferenceDates,
  type MedicalPanelFilters,
  type MedicalPanelRow,
} from "@/lib/medical-panel-rows";
import { teamSeasonLabel } from "@/lib/team-label";
import { categoryRequiresMedicalCheckup } from "@/components/equipos/team-categories";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { PrintableSheet } from "@/components/printable-sheet";
import { TableSkeleton } from "@/components/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = { team?: string; status?: string; q?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("medicoListado") };
}

/** Sin fecha registrada se imprime una raya, igual que en el acta federativa. */
const EMPTY = "—";

/**
 * El documento en sí. Va en su propio componente para poder darle un
 * `<Suspense>`: depende del reloj de la petición (el estado de cada certificado
 * se calcula contra "hoy") y de los filtros de la URL, así que no se puede
 * prerenderizar.
 */
async function MedicalListDocument({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<SearchParams>;
}) {
  // Marca el componente como de tiempo de petición antes de leer el reloj; sin
  // esto el prerender congelaría "hoy" (ver next-prerender-current-time).
  await connection();
  const { today, cutoff } = medicalReferenceDates(new Date());

  const [{ team, status, q }, allPersons, allTeams, club, t, tEquipos] = await Promise.all([
    searchParams,
    db.query.persons.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        nationalId: true,
        medicalCertUntil: true,
      },
      with: {
        memberships: {
          columns: { role: true },
          with: {
            team: {
              columns: { id: true, name: true, category: true },
              with: { season: { columns: { isCurrent: true, name: true } } },
            },
          },
        },
      },
    }),
    db.query.teams.findMany({ with: { season: true } }),
    getClubSettings(),
    getTranslations("Medico"),
    getTranslations("Equipos"),
  ]);

  // Mismo alcance que el panel: quien tiene ficha en un equipo de la temporada
  // activa, sea jugador, entrenador o staff.
  const rows: MedicalPanelRow[] = allPersons
    .filter((p) => p.memberships.some((m) => m.team.season.isCurrent))
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate,
      nationalId: p.nationalId,
      medicalCertUntil: p.medicalCertUntil,
      teams: p.memberships
        .filter((m) => m.team.season.isCurrent)
        .map((m) => ({
          id: m.team.id,
          name: m.team.name,
          role: m.role,
          requiresMedicalCheckup: categoryRequiresMedicalCheckup(m.team.category),
        })),
    }));

  const filters: MedicalPanelFilters = {
    query: q ?? "",
    team: team ?? "all",
    status: status ?? "all",
  };
  const listed = filterMedicalPanelRows(rows, filters, today, cutoff)
    // Orden de listín: apellidos y, a igualdad, nombre.
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, locale) ||
        a.firstName.localeCompare(b.firstName, locale),
    );

  // Documento para leer, no volcado técnico: las fechas van en formato local.
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const fmtDate = (value: string | null) => (value ? dateFmt.format(new Date(value)) : EMPTY);

  const currentSeason = allTeams.find((tm) => tm.season.isCurrent)?.season ?? null;
  const selectedTeam = allTeams.find((tm) => tm.id === filters.team);
  const teamLabel = selectedTeam
    ? teamSeasonLabel(selectedTeam, selectedTeam.season)
    : t("filterTeamAll");
  const statusLabel =
    filters.status === "all"
      ? t("filterStatusAll")
      : t(`filterStatus.${filters.status}` as "filterStatus.expired");

  return (
    <PrintableSheet>
      {/* Cabecera: qué documento es, de qué club y con qué filtros se sacó */}
      <div className="flex items-start justify-between gap-6 border-b pb-[9pt]">
        <div>
          <h1 className="text-[11pt] font-semibold tracking-tight">{t("listTitle")}</h1>
          <p className="text-[8pt] text-muted-foreground">{club?.legalName ?? "Areto"}</p>
        </div>
        <div className="text-right text-[8pt]">
          {currentSeason ? <p className="font-medium">{currentSeason.name}</p> : null}
          <p className="text-muted-foreground">
            {t("filterTeamLabel")}: {teamLabel}
          </p>
          <p className="text-muted-foreground">
            {t("filterStatusLabel")}: {statusLabel}
          </p>
          {filters.query.trim() ? (
            <p className="text-muted-foreground">
              {t("listSearchLabel")}: {filters.query.trim()}
            </p>
          ) : null}
          <p className="mt-1 text-[7pt] text-muted-foreground">
            {t("listGeneratedOn", { date: dateFmt.format(new Date()) })}
          </p>
        </div>
      </div>

      {listed.length === 0 ? (
        <p className="text-[8pt] text-muted-foreground">{t("noResultsDescription")}</p>
      ) : (
        /* Tabla de documento, no de pantalla: `table-fixed` con anchos por
           columna (con siete columnas, el reparto automático se lo comen
           «nombre» y «equipos», que concatena varios) y sin el
           `whitespace-nowrap` que `ui/table.tsx` pone por defecto, que es lo que
           ensancha la tabla más allá de la hoja y saca el scroll horizontal. */
        <Table className="table-fixed text-[8pt] [&_td]:px-[3pt] [&_td]:py-[1.5pt] [&_th]:px-[3pt] [&_th]:py-[1.5pt] [&_td]:whitespace-normal [&_th]:break-words [&_th]:whitespace-normal">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">{t("colListName")}</TableHead>
              <TableHead className="w-[14%]">{t("colNationalId")}</TableHead>
              <TableHead className="w-[12%]">{t("colBirthDate")}</TableHead>
              <TableHead className="w-[24%]">{t("colTeams")}</TableHead>
              <TableHead className="w-[13%]">{t("colRole")}</TableHead>
              <TableHead className="w-[12%]">{t("colExpiry")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listed.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="align-top font-medium">
                  {row.lastName}, {row.firstName}
                </TableCell>
                <TableCell className="align-top">{row.nationalId ?? EMPTY}</TableCell>
                <TableCell className="align-top">{fmtDate(row.birthDate)}</TableCell>
                <TableCell className="align-top">
                  {row.teams.map((tm) => tm.name).join(" / ")}
                </TableCell>
                <TableCell className="align-top">
                  {medicalPanelRowRoles(row)
                    .map((role) => tEquipos(`roleOption.${role}`))
                    .join(" / ")}
                </TableCell>
                <TableCell className="align-top">{fmtDate(row.medicalCertUntil)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PrintableSheet>
  );
}

/**
 * Listado imprimible de reconocimientos médicos: el panel filtra y esta página
 * saca el documento con los datos que pide el centro médico (DNI y fecha de
 * nacimiento incluidos), listo para imprimir o guardar como PDF.
 */
export default async function MedicoListadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("personas.medical.view");
  const t = await getTranslations("Medico");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href="/medico" label={t("backToPanel")} />
        <PrintButton label={t("printAction")} />
      </div>

      <Suspense
        fallback={
          <PrintableSheet>
            <TableSkeleton columns={["w-40", "w-20", "w-20", "w-24", "w-16", "w-20"]} />
          </PrintableSheet>
        }
      >
        <MedicalListDocument locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
