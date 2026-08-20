"use client";

import { useMemo, useState } from "react";
import { SearchIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { medicalCertStatus, MEDICAL_EXPIRY_WINDOW_DAYS, type MedicalCertStatus } from "@/lib/medical-status";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TeamOption = { id: string; label: string };

type CertRow = {
  id: string;
  firstName: string;
  lastName: string;
  medicalCertUntil: string | null;
  teams: { id: string; name: string; role: string; requiresMedicalCheckup: boolean }[];
};

type InjuryRow = {
  id: string;
  personId: string;
  personName: string;
  occurredOn: string;
  description: string;
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

export function MedicalPanelBrowser({
  certRows,
  injuryRows,
  teamOptions,
}: {
  certRows: CertRow[];
  injuryRows: InjuryRow[];
  teamOptions: TeamOption[];
}) {
  const t = useTranslations("Medico");
  const tEquipos = useTranslations("Equipos");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");

  // Fechas de referencia calculadas en cliente, para no forzar el prerender
  // estático de la página a depender del reloj de la petición.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cutoff = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + MEDICAL_EXPIRY_WINDOW_DAYS);
    return cutoffDate.toISOString().slice(0, 10);
  }, []);

  const statusRows = useMemo(
    () =>
      certRows.map((row) => {
        // Exento si ninguno de sus equipos activos exige reconocimiento
        // médico; si tiene varios equipos y al menos uno lo exige, sigue
        // haciendo falta.
        const requiresCheckup = row.teams.some((tm) => tm.requiresMedicalCheckup);
        return {
          ...row,
          status: medicalCertStatus(row.medicalCertUntil, today, cutoff, requiresCheckup),
        };
      }),
    [certRows, today, cutoff],
  );

  const overview = useMemo(() => {
    const counts = { expired: 0, expiring: 0, missing: 0, ok: 0, exempt: 0 };
    for (const row of statusRows) counts[row.status]++;
    return { total: statusRows.length, ...counts };
  }, [statusRows]);

  const filteredCertRows = useMemo(() => {
    let result = statusRows;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      result = result.filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle),
      );
    }
    if (team !== "all") {
      result = result.filter((p) => p.teams.some((tm) => tm.id === team));
    }
    if (status === "needsUpdate") {
      result = result.filter(
        (p) => p.status === "expired" || p.status === "expiring" || p.status === "missing",
      );
    } else if (status !== "all") {
      result = result.filter((p) => p.status === status);
    }
    return result;
  }, [statusRows, query, team, status]);

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2">
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-56 pl-8"
          />
        </div>
        <Select value={team} onValueChange={(v) => setTeam(v ?? "all")}>
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
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
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
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("checkupsSection")}
        </h2>
        {filteredCertRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noResultsDescription")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colTeams")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCertRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/personas/${row.id}?tab=medico`}
                      className="hover:underline"
                    >
                      {row.firstName} {row.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>
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
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("injuryReportsSection")}
        </h2>
        {filteredInjuryRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {injuryRows.length === 0 ? t("noInjuryReportsDescription") : t("noResultsDescription")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colInjuryDate")}</TableHead>
                <TableHead>{t("colInjuryPerson")}</TableHead>
                <TableHead>{t("colTeams")}</TableHead>
                <TableHead>{t("colInjuryDescription")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInjuryRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.occurredOn}</TableCell>
                  <TableCell>
                    <Link
                      href={`/personas/${row.personId}?tab=medico`}
                      className="hover:underline"
                    >
                      {row.personName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.teams.map((tm) => (
                        <Badge key={tm.id} variant="secondary">
                          {tm.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
