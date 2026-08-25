import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeftIcon } from "lucide-react";
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
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/print-button";
import { TableSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-lg border p-8">
      {/* Cabecera: qué documento es, de qué club y con qué filtros se sacó */}
      <div className="flex items-start justify-between gap-6 border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("listTitle")}</h1>
          <p className="text-sm text-muted-foreground">{club?.legalName ?? "Areto"}</p>
        </div>
        <div className="text-right text-sm">
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
          <p className="mt-1 text-xs text-muted-foreground">
            {t("listGeneratedOn", { date: dateFmt.format(new Date()) })}
          </p>
        </div>
      </div>

      {listed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noResultsDescription")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colListName")}</TableHead>
              <TableHead>{t("colNationalId")}</TableHead>
              <TableHead>{t("colBirthDate")}</TableHead>
              <TableHead>{t("colTeams")}</TableHead>
              <TableHead>{t("colRole")}</TableHead>
              <TableHead>{t("colExpiry")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listed.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.lastName}, {row.firstName}
                </TableCell>
                <TableCell>{row.nationalId ?? EMPTY}</TableCell>
                <TableCell>{fmtDate(row.birthDate)}</TableCell>
                <TableCell>{row.teams.map((tm) => tm.name).join(" / ")}</TableCell>
                <TableCell>
                  {medicalPanelRowRoles(row)
                    .map((role) => tEquipos(`roleOption.${role}`))
                    .join(" / ")}
                </TableCell>
                <TableCell>{fmtDate(row.medicalCertUntil)}</TableCell>
                <TableCell>{t(`filterStatus.${row.status}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
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
        <Button variant="ghost" size="sm" render={<Link href="/medico" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToPanel")}
        </Button>
        <PrintButton label={t("printAction")} />
      </div>

      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-3xl rounded-lg border p-8">
            <TableSkeleton columns={["w-40", "w-20", "w-20", "w-24", "w-16", "w-20", "w-20"]} />
          </div>
        }
      >
        <MedicalListDocument locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
