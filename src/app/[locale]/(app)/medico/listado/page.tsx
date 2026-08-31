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
import { EMPTY } from "@/components/empty-value";
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

type SearchParams = { team?: string; status?: string; q?: string; tipo?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("medicoListado") };
}

/**
 * Cabecera común a las dos variantes del documento: qué es, de qué club y con
 * qué filtros se sacó. Compartida y no duplicada en cada variante para que un
 * ajuste de estilo (o el CSS de impresión) no pueda divergir entre las dos.
 */
function ListHeader({
  title,
  club,
  currentSeason,
  teamLabel,
  statusLabel,
  query,
  generatedOn,
  t,
}: {
  title: string;
  club: { legalName: string | null } | null;
  currentSeason: { name: string } | null;
  teamLabel: string;
  statusLabel: string | null;
  query: string;
  generatedOn: string;
  t: Awaited<ReturnType<typeof getTranslations<"Medico">>>;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b pb-[9pt]">
      <div>
        <h1 className="text-[11pt] font-semibold tracking-tight">{title}</h1>
        <p className="text-[8pt] text-muted-foreground">{club?.legalName ?? "Areto"}</p>
      </div>
      <div className="text-right text-[8pt]">
        {currentSeason ? <p className="font-medium">{currentSeason.name}</p> : null}
        <p className="text-muted-foreground">
          {t("filterTeamLabel")}: {teamLabel}
        </p>
        {statusLabel ? (
          <p className="text-muted-foreground">
            {t("filterStatusLabel")}: {statusLabel}
          </p>
        ) : null}
        {query.trim() ? (
          <p className="text-muted-foreground">
            {t("listSearchLabel")}: {query.trim()}
          </p>
        ) : null}
        <p className="mt-1 text-[7pt] text-muted-foreground">
          {t("listGeneratedOn", { date: generatedOn })}
        </p>
      </div>
    </div>
  );
}

/**
 * Documento de certificados. Va en su propio componente para poder darle un
 * `<Suspense>`: depende del reloj de la petición (el estado de cada
 * certificado se calcula contra "hoy") y de los filtros de la URL, así que no
 * se puede prerenderizar.
 */
async function CertificatesListDocument({
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
      <ListHeader
        title={t("listTitle")}
        club={club}
        currentSeason={currentSeason}
        teamLabel={teamLabel}
        statusLabel={statusLabel}
        query={filters.query}
        generatedOn={dateFmt.format(new Date())}
        t={t}
      />

      {listed.length === 0 ? (
        <p className="text-[8pt] text-muted-foreground">{t("noResultsDescription")}</p>
      ) : (
        /* Tabla de documento, no de pantalla: `table-fixed` con anchos por
           columna (con siete columnas, el reparto automático se lo comen
           «nombre» y «equipos», que concatena varios). Las celdas rompen línea
           salvo las atómicas —DNI y fechas—, que llevan `nowrap`: lo contrario
           ensancha la tabla más allá de la hoja y saca el scroll horizontal. */
        <Table className="table-fixed text-[8pt] [&_td]:px-[3pt] [&_td]:py-[1.5pt] [&_th]:px-[3pt] [&_th]:py-[1.5pt] [&_th]:break-words">
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
                <TableCell nowrap className="align-top">{row.nationalId ?? EMPTY}</TableCell>
                <TableCell nowrap className="align-top">{fmtDate(row.birthDate)}</TableCell>
                <TableCell className="align-top">
                  {row.teams.map((tm) => tm.name).join(" / ")}
                </TableCell>
                <TableCell className="align-top">
                  {medicalPanelRowRoles(row)
                    .map((role) => tEquipos(`roleOption.${role}`))
                    .join(" / ")}
                </TableCell>
                <TableCell nowrap className="align-top">{fmtDate(row.medicalCertUntil)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PrintableSheet>
  );
}

/**
 * Documento de partes de lesión: mismas columnas que la pestaña de partes en
 * pantalla (fecha, persona, equipos), no las del impreso federativo completo
 * — ese ya tiene su propio documento por parte
 * (`personas/[personId]/parte-lesion/[reportId]`).
 */
async function InjuryReportsListDocument({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<SearchParams>;
}) {
  await connection();

  const [{ team, q }, allPersons, allTeams, club, t] = await Promise.all([
    searchParams,
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true },
      with: {
        memberships: {
          columns: {},
          with: {
            team: {
              columns: { id: true, name: true },
              with: { season: { columns: { isCurrent: true } } },
            },
          },
        },
        injuryReports: {
          columns: { id: true, occurredOn: true },
          orderBy: (r, { desc }) => [desc(r.occurredOn)],
        },
      },
    }),
    db.query.teams.findMany({ with: { season: true } }),
    getClubSettings(),
    getTranslations("Medico"),
  ]);

  const query = q ?? "";
  const selectedTeam = team && team !== "all" ? team : "all";

  let rows = allPersons
    .filter((p) => p.memberships.some((m) => m.team.season.isCurrent))
    .flatMap((p) =>
      p.injuryReports.map((r) => ({
        id: r.id,
        personName: `${p.firstName} ${p.lastName}`,
        occurredOn: r.occurredOn,
        teams: p.memberships
          .filter((m) => m.team.season.isCurrent)
          .map((m) => ({ id: m.team.id, name: m.team.name })),
      })),
    );
  const needle = query.trim().toLowerCase();
  if (needle) rows = rows.filter((r) => r.personName.toLowerCase().includes(needle));
  if (selectedTeam !== "all") rows = rows.filter((r) => r.teams.some((tm) => tm.id === selectedTeam));
  rows.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const currentSeason = allTeams.find((tm) => tm.season.isCurrent)?.season ?? null;
  const selectedTeamRow = allTeams.find((tm) => tm.id === selectedTeam);
  const teamLabel = selectedTeamRow
    ? teamSeasonLabel(selectedTeamRow, selectedTeamRow.season)
    : t("filterTeamAll");

  return (
    <PrintableSheet>
      <ListHeader
        title={t("injuryReportsSection")}
        club={club}
        currentSeason={currentSeason}
        teamLabel={teamLabel}
        statusLabel={null}
        query={query}
        generatedOn={dateFmt.format(new Date())}
        t={t}
      />

      {rows.length === 0 ? (
        <p className="text-[8pt] text-muted-foreground">{t("noResultsDescription")}</p>
      ) : (
        <Table className="table-fixed text-[8pt] [&_td]:px-[3pt] [&_td]:py-[1.5pt] [&_th]:px-[3pt] [&_th]:py-[1.5pt] [&_th]:break-words">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[15%]">{t("colInjuryDate")}</TableHead>
              <TableHead className="w-[35%]">{t("colInjuryPerson")}</TableHead>
              <TableHead className="w-[50%]">{t("colTeams")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell nowrap className="align-top">
                  {dateFmt.format(new Date(row.occurredOn))}
                </TableCell>
                <TableCell className="align-top font-medium">{row.personName}</TableCell>
                <TableCell className="align-top">
                  {row.teams.map((tm) => tm.name).join(" / ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PrintableSheet>
  );
}

/**
 * Elige el documento según `?tipo=`. En su propio componente, y no en la
 * página, para que decidir el tipo no obligue a leer `searchParams` fuera del
 * `<Suspense>` de abajo: eso bloquearía el prerender de toda la ruta en vez
 * de solo el documento (ver `next-prerender-current-time`).
 */
async function MedicalListDocument({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<SearchParams>;
}) {
  const { tipo } = await searchParams;
  return tipo === "partes" ? (
    <InjuryReportsListDocument locale={locale} searchParams={searchParams} />
  ) : (
    <CertificatesListDocument locale={locale} searchParams={searchParams} />
  );
}

/**
 * Listado imprimible del panel médico: el panel filtra y esta página saca el
 * documento con los datos que pide cada trámite, listo para imprimir o
 * guardar como PDF. `tipo=partes` saca los partes de lesión; por defecto (o
 * `tipo=certificados`) saca los reconocimientos médicos, con DNI y fecha de
 * nacimiento incluidos, que es lo que pide el centro médico.
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
            {/* Mismo relleno que el `loading.tsx` de la ruta: un parpadeo, no dos. */}
            <PrintableSheetBodySkeleton lines={16} />
          </PrintableSheet>
        }
      >
        <MedicalListDocument locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
