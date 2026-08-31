"use client";

import { useMemo } from "react";
import {
  BriefcaseIcon,
  CheckIcon,
  SearchIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  UserIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { DeleteTeamDialog } from "@/components/equipos/delete-team-dialog";
import { TeamDialog } from "@/components/equipos/team-dialog";
import { PaginationBar } from "@/components/pagination-bar";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFilterParams, useSearchText } from "@/hooks/use-filter-params";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { ExportMenu } from "@/components/export-menu";
import { formatCents } from "@/lib/money";
import type { RosterHealthAlerts } from "@/lib/roster-health";

type TeamRow = {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  minBirthYear: number | null;
  maxBirthYear: number | null;
  federationGroup: string | null;
  federationCode: string | null;
  playerFeeCents: number | null;
  playerFeePeriod: string;
  playerFeeNotes: string | null;
  roster: { role: string }[];
  alerts: RosterHealthAlerts;
  hardCount: number;
  softCount: number;
};

const ROLE_ICONS: Record<string, typeof UserIcon> = {
  player: UserIcon,
  coach: UserCheckIcon,
  staff: BriefcaseIcon,
};

/** Filtros de la pantalla, con su nombre en la URL y su valor de partida. */
const FILTER_DEFAULTS = { q: "" };

export function EquiposBrowser({
  teams,
  locale,
  canManage,
}: {
  teams: TeamRow[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Equipos");
  const [filters, setFilters] = useFilterParams(FILTER_DEFAULTS);
  const [query, setQuery] = useSearchText(filters.q, (value) =>
    setFilters({ q: value }),
  );

  /** Texto (traducido) de los avisos de salud de una plantilla, para el tooltip. */
  function healthIssueLines(alerts: RosterHealthAlerts): string[] {
    const lines: string[] = [];
    if (alerts.duplicateJerseys.length > 0)
      lines.push(t("healthDuplicateJerseys", { numbers: alerts.duplicateJerseys.join(", ") }));
    if (alerts.ageOutOfRange > 0)
      lines.push(t("healthAgeOutOfRange", { count: alerts.ageOutOfRange }));
    if (alerts.medicalExpired > 0)
      lines.push(t("healthMedicalExpired", { count: alerts.medicalExpired }));
    if (alerts.medicalExpiring > 0)
      lines.push(t("healthMedicalExpiring", { count: alerts.medicalExpiring }));
    if (alerts.noJersey > 0) lines.push(t("healthNoJersey", { count: alerts.noJersey }));
    return lines;
  }

  function roleCounts(roster: { role: string }[]) {
    return ["player", "coach", "staff"].map((role) => ({
      role,
      count: roster.filter((m) => m.role === role).length,
    }));
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return teams;
    const needle = query.trim().toLowerCase();
    return teams.filter((team) => {
      const categoryLabel = team.category ? t(`category.${team.category}`) : "";
      return (
        team.name.toLowerCase().includes(needle) ||
        categoryLabel.toLowerCase().includes(needle)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, query]);

  const { page, pageCount, setPage, pageRows } = usePagedRows(filtered);

  function exportData() {
    const headers = [
      t("colName"),
      t("colCategory"),
      t("colFee"),
      t("colRoster"),
      t("colHealth"),
    ];
    const rows = filtered.map((team) => {
      const issues = healthIssueLines(team.alerts);
      const roster = roleCounts(team.roster)
        .filter(({ count }) => count > 0)
        .map(({ role, count }) => `${count} ${t(`roleOption.${role}`)}`)
        .join(", ");
      return [
        team.name,
        team.category ? t(`category.${team.category}`) : "",
        team.playerFeeCents !== null
          ? t(`feePeriodShort.${team.playerFeePeriod}`, {
              amount: formatCents(team.playerFeeCents, locale),
            })
          : "",
        roster,
        issues.length > 0 ? issues.join(" · ") : t("healthAllGood"),
      ];
    });
    return { headers, rows };
  }

  return (
    <>
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
        <div className="ml-auto">
          <ExportMenu filename="equipos" getData={exportData} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noResultsTitle")}
          description={t("noResultsDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead priority="secondary">{t("colCategory")}</TableHead>
              <TableHead priority="tertiary">{t("colFee")}</TableHead>
              <TableHead priority="secondary">{t("colRoster")}</TableHead>
              <TableHead priority="tertiary">{t("colHealth")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">{t("colActions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((team) => {
              const issues = healthIssueLines(team.alerts);
              return (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">
                    <HoverPrefetchLink href={`/equipos/${team.id}`} className="hover:underline">
                      {team.name}
                    </HoverPrefetchLink>
                  </TableCell>
                  <TableCell priority="secondary">
                    {team.category ? t(`category.${team.category}`) : "—"}
                    {team.gender ? ` · ${t(`gender.${team.gender}`)}` : ""}
                  </TableCell>
                  <TableCell priority="tertiary" nowrap>
                    {team.playerFeeCents !== null
                      ? t(`feePeriodShort.${team.playerFeePeriod}`, {
                          amount: formatCents(team.playerFeeCents, locale),
                        })
                      : "—"}
                  </TableCell>
                  <TableCell priority="secondary">
                    <div className="flex flex-wrap gap-1">
                      {roleCounts(team.roster).map(({ role, count }) => {
                        if (count === 0) return null;
                        const Icon = ROLE_ICONS[role] ?? UserIcon;
                        return (
                          <Badge
                            key={role}
                            variant="secondary"
                            className="gap-1"
                            title={t(`roleOption.${role}`)}
                          >
                            <Icon className="size-3" />
                            {count}
                          </Badge>
                        );
                      })}
                      {team.roster.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell priority="tertiary">
                    {issues.length === 0 ? (
                      <CheckIcon
                        className="size-4 text-muted-foreground"
                        aria-label={t("healthAllGood")}
                      />
                    ) : (
                      <Badge
                        variant={team.hardCount > 0 ? "destructive" : "secondary"}
                        className="gap-1"
                        title={issues.join(" · ")}
                      >
                        <TriangleAlertIcon className="size-3" />
                        {team.hardCount + team.softCount}
                      </Badge>
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <TeamDialog
                          mode="edit"
                          team={{
                            id: team.id,
                            name: team.name,
                            category: team.category,
                            gender: team.gender,
                            minBirthYear: team.minBirthYear,
                            maxBirthYear: team.maxBirthYear,
                            federationGroup: team.federationGroup,
                            federationCode: team.federationCode,
                            playerFeeCents: team.playerFeeCents,
                            playerFeePeriod: team.playerFeePeriod,
                            playerFeeNotes: team.playerFeeNotes,
                          }}
                        />
                        <DeleteTeamDialog id={team.id} name={team.name} />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* La barra no pinta nada mientras quepa todo en una página. */}
      <PaginationBar page={page} pageCount={pageCount} onPageChange={setPage} />
    </>
  );
}
