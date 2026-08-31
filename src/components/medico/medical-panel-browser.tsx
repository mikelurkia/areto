"use client";

import { useMemo } from "react";
import {
  ClipboardListIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFilterParams, useSearchText } from "@/hooks/use-filter-params";
import { ExportMenu } from "@/components/export-menu";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { useTabParam } from "@/hooks/use-tab-param";
import {
  EMPTY_MEDICAL_PANEL_FILTERS,
  filterMedicalPanelRows,
  medicalPanelRowRoles,
  medicalReferenceDates,
  type MedicalPanelRow,
} from "@/lib/medical-panel-rows";
import { type MedicalCertStatus } from "@/lib/medical-status";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { PaginationBar } from "@/components/pagination-bar";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TeamOption = { id: string; label: string };

type CertRow = MedicalPanelRow;

type InjuryRow = {
  id: string;
  personId: string;
  personName: string;
  occurredOn: string;
  teams: { id: string; name: string }[];
};

/** Cifra y etiqueta en línea, igual que en `roster-health.tsx`. */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Valores que acepta el select de estado, incluido el agregado "needsUpdate". */
const STATUS_FILTER_VALUES = [
  "expired",
  "expiring",
  "missing",
  "ok",
  "exempt",
  "needsUpdate",
];

function StatusBadge({
  status,
  date,
  t,
}: {
  status: MedicalCertStatus;
  date: string | null;
  t: ReturnType<typeof useTranslations<"Medico">>;
}) {
  if (status === "exempt") return <Badge variant="outline">{t("statusExemptBadge")}</Badge>;
  if (status === "missing") return <Badge variant="secondary">{t("statusMissingBadge")}</Badge>;
  if (status === "expired")
    return <Badge variant="destructive">{t("statusExpiredBadge", { date: date! })}</Badge>;
  if (status === "expiring")
    return <Badge variant="warning">{t("statusExpiringBadge", { date: date! })}</Badge>;
  return <Badge variant="outline">{t("statusOkBadge", { date: date! })}</Badge>;
}

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = { q: "", equipo: "all", estado: "all" };

/** Primera vista = la de por defecto, la que no deja parámetro en la URL. */
const VIEWS = ["certificados", "partes"] as const;

export function MedicalPanelBrowser({
  certRows,
  injuryRows,
  teamOptions,
  canManage,
}: {
  certRows: CertRow[];
  injuryRows: InjuryRow[];
  teamOptions: TeamOption[];
  canManage: boolean;
}) {
  const t = useTranslations("Medico");
  const tEquipos = useTranslations("Equipos");
  // El panel de alertas enlaza aquí con el filtro ya puesto
  // (`/medico?estado=needsUpdate`); ahora esa misma URL es la que manda mientras
  // se navega, no solo la semilla del estado inicial.
  const [view, setView] = useTabParam("vista", VIEWS);
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const { equipo: team } = filters;
  // El valor viene de la URL, así que puede ser cualquier cosa.
  const status = STATUS_FILTER_VALUES.includes(filters.estado)
    ? filters.estado
    : "all";
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );

  // Fechas de referencia calculadas en cliente, para no forzar el prerender
  // estático de la página a depender del reloj de la petición.
  const { today, cutoff } = useMemo(() => medicalReferenceDates(new Date()), []);

  const statusRows = useMemo(
    () => filterMedicalPanelRows(certRows, EMPTY_MEDICAL_PANEL_FILTERS, today, cutoff),
    [certRows, today, cutoff],
  );

  const overview = useMemo(() => {
    const counts = { expired: 0, expiring: 0, missing: 0, ok: 0, exempt: 0 };
    for (const row of statusRows) counts[row.status]++;
    return { total: statusRows.length, ...counts };
  }, [statusRows]);

  const filteredCertRows = useMemo(
    () => filterMedicalPanelRows(certRows, { query, team, status }, today, cutoff),
    [certRows, query, team, status, today, cutoff],
  );

  const filteredInjuryRows = useMemo(() => {
    let result = injuryRows;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((r) => r.personName.toLowerCase().includes(needle));
    }
    if (team !== "all") {
      result = result.filter((r) => r.teams.some((tm) => tm.id === team));
    }
    return result;
  }, [injuryRows, query, team]);

  // Dos tablas, dos paginaciones: los reconocimientos son toda la plantilla del
  // club y los partes de lesión unos pocos al año.
  const certPage = usePagedRows(filteredCertRows);
  const injuryPage = usePagedRows(filteredInjuryRows, 10);

  // Los filtros viven en estado local, así que viajan al listado imprimible
  // por la URL: es lo que le permite reproducir en servidor la misma selección
  // que hay en pantalla. Los valores neutros no se escriben. "estado" solo
  // pinta algo en el listado de certificados: en partes se omite.
  const exportParams = new URLSearchParams();
  if (view === "partes") exportParams.set("tipo", "partes");
  if (team !== "all") exportParams.set("team", team);
  if (view === "certificados" && status !== "all") exportParams.set("status", status);
  if (query.trim()) exportParams.set("q", query.trim());
  const printListHref = exportParams.size
    ? `/medico/listado?${exportParams}`
    : "/medico/listado";

  function certificatesData() {
    const headers = [
      t("colListName"),
      t("colNationalId"),
      t("colBirthDate"),
      t("colTeams"),
      t("colRole"),
      t("colExpiry"),
      t("colStatus"),
    ];
    // Fechas en ISO crudo, como el resto de CSV del proyecto: así ordenan e
    // importan bien en la hoja de cálculo.
    const rows = filteredCertRows.map((row) => [
      `${row.lastName}, ${row.firstName}`,
      row.nationalId ?? "",
      row.birthDate ?? "",
      row.teams.map((tm) => tm.name).join(" / "),
      medicalPanelRowRoles(row)
        .map((role) => tEquipos(`roleOption.${role}`))
        .join(" / "),
      row.medicalCertUntil ?? "",
      t(`filterStatus.${row.status}`),
    ]);
    return { headers, rows };
  }

  function injuryData() {
    const headers = [t("colInjuryDate"), t("colInjuryPerson"), t("colTeams")];
    const rows = filteredInjuryRows.map((row) => [
      row.occurredOn,
      row.personName,
      row.teams.map((tm) => tm.name).join(" / "),
    ]);
    return { headers, rows };
  }

  const alertBadges: React.ReactNode[] = [];
  if (overview.expired > 0) {
    alertBadges.push(
      <Badge key="expired" variant="destructive">
        {t("statExpired", { count: overview.expired })}
      </Badge>,
    );
  }
  if (overview.expiring > 0) {
    alertBadges.push(
      <Badge key="expiring" variant="warning">
        {t("statExpiring", { count: overview.expiring })}
      </Badge>,
    );
  }
  if (overview.missing > 0) {
    alertBadges.push(
      <Badge key="missing" variant="secondary">
        {t("statMissing", { count: overview.missing })}
      </Badge>,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card size="sm" className="flex-row flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing) print:hidden">
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Stat label={t("statTotal")} value={overview.total} />
        </dl>
        {alertBadges.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <TriangleAlertIcon className="size-3.5 text-muted-foreground" />
            {alertBadges}
          </div>
        ) : (
          <p className="ml-auto text-xs text-muted-foreground">{t("allGood")}</p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-56 pl-8"
          />
        </div>
        <Select value={team} onValueChange={(v) => setFilters({ equipo: v ?? "all" })}>
          <SelectTrigger aria-label={t("filterTeamLabel")}>
            <SelectValue>
              {(value: string) =>
                value === "all"
                  ? t("filterTeamAll")
                  : teamOptions.find((o) => o.id === value)?.label ?? t("filterTeamAll")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterTeamAll")}</SelectItem>
            {teamOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view === "certificados" ? (
          <Select value={status} onValueChange={(v) => setFilters({ estado: v ?? "all" })}>
            <SelectTrigger aria-label={t("filterStatusLabel")}>
              <SelectValue>
                {(value: string) =>
                  value === "all" ? t("filterStatusAll") : t(`filterStatus.${value}` as "filterStatus.expired")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
              <SelectItem value="needsUpdate">{t("filterStatus.needsUpdate")}</SelectItem>
              <SelectItem value="expired">{t("filterStatus.expired")}</SelectItem>
              <SelectItem value="expiring">{t("filterStatus.expiring")}</SelectItem>
              <SelectItem value="missing">{t("filterStatus.missing")}</SelectItem>
              <SelectItem value="ok">{t("filterStatus.ok")}</SelectItem>
              <SelectItem value="exempt">{t("filterStatus.exempt")}</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <div className="ml-auto">
          {/* Un solo menú para las dos pestañas: exporta e imprime lo que se
              está viendo, y el listado imprimible ya recibe estos mismos
              filtros por la URL. */}
          <ExportMenu
            filename={
              view === "certificados" ? "reconocimientos-medicos" : "partes-lesion"
            }
            getData={view === "certificados" ? certificatesData : injuryData}
            printHref={printListHref}
          />
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as (typeof VIEWS)[number])}>
        <TabsList>
          <TabsTrigger value="certificados">{t("tabCertificados")}</TabsTrigger>
          <TabsTrigger value="partes">{t("tabPartes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="certificados">
          <div className="flex flex-col gap-3">
            {filteredCertRows.length === 0 ? (
              <SectionPlaceholder size="compact" title={t("noResultsDescription")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colName")}</TableHead>
                    <TableHead priority="secondary">{t("colTeams")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certPage.pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <HoverPrefetchLink
                          href={`/personas/${row.id}?tab=medico`}
                          className="hover:underline"
                        >
                          {row.firstName} {row.lastName}
                        </HoverPrefetchLink>
                      </TableCell>
                      <TableCell priority="secondary">
                        <div className="flex flex-wrap gap-1">
                          {row.teams.map((tm) => (
                            <Badge
                              key={tm.id}
                              variant="secondary"
                              title={tEquipos(`roleOption.${tm.role}` as "roleOption.player")}
                            >
                              {tm.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} date={row.medicalCertUntil} t={t} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <PaginationBar
              page={certPage.page}
              pageCount={certPage.pageCount}
              onPageChange={certPage.setPage}
            />
          </div>
        </TabsContent>
        <TabsContent value="partes">
          <div className="flex flex-col gap-3">
            {filteredInjuryRows.length === 0 ? (
              <SectionPlaceholder
                size="compact"
                title={
                  injuryRows.length === 0
                    ? t("noInjuryReportsDescription")
                    : t("noResultsDescription")
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colInjuryDate")}</TableHead>
                    <TableHead>{t("colInjuryPerson")}</TableHead>
                    <TableHead priority="secondary">{t("colTeams")}</TableHead>
                    {canManage ? (
                      <TableHead className="print:hidden">
                        <span className="sr-only">{t("colActions")}</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {injuryPage.pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell nowrap className="font-medium">{row.occurredOn}</TableCell>
                  <TableCell>
                    <HoverPrefetchLink
                      href={`/personas/${row.personId}?tab=medico`}
                      className="hover:underline"
                    >
                      {row.personName}
                    </HoverPrefetchLink>
                  </TableCell>
                  <TableCell priority="secondary">
                    <div className="flex flex-wrap gap-1">
                      {row.teams.map((tm) => (
                        <Badge key={tm.id} variant="secondary">
                          {tm.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="print:hidden">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<HoverPrefetchLink href={`/personas/${row.personId}/parte-lesion/${row.id}`} />}
                        nativeButton={false}
                      >
                        <ClipboardListIcon />
                        <span className="sr-only">
                          {t("viewInjuryReportSr", { date: row.occurredOn })}
                        </span>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
                </TableBody>
              </Table>
            )}
            <PaginationBar
              page={injuryPage.page}
              pageCount={injuryPage.pageCount}
              onPageChange={injuryPage.setPage}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
