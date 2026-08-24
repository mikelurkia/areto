import {
  BriefcaseIcon,
  CheckIcon,
  ShieldHalf,
  TriangleAlertIcon,
  UserCheckIcon,
  UserIcon,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons, teams } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { computeRosterHealth, type RosterHealthAlerts } from "@/lib/roster-health";
import { Link } from "@/i18n/navigation";
import { SeasonSelect } from "@/components/equipos/season-select";
import { TeamDialog } from "@/components/equipos/team-dialog";
import { DeleteTeamDialog } from "@/components/equipos/delete-team-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("equipos") };
}

export default async function EquiposPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("equipos.view");
  const t = await getTranslations("Equipos");
  const canManage = hasPermission(user, "equipos.manage");

  // Los equipos sí dependen de la temporada elegida, pero el parámetro de la URL
  // y el listado de temporadas se pueden resolver a la vez.
  const [{ season: seasonParam }, allSeasons] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
  ]);

  const selectedSeason =
    allSeasons.find((s) => s.id === seasonParam) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const currentTeams = selectedSeason
    ? await db.query.teams.findMany({
        where: eq(teams.seasonId, selectedSeason.id),
        orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
        with: {
          memberships: {
            with: {
              person: {
                columns: {
                  birthDate: true,
                  medicalCertUntil: true,
                },
              },
            },
          },
        },
      })
    : [];

  // Texto (traducido) de los avisos de salud de una plantilla, para el tooltip.
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <SeasonSelect
          seasons={allSeasons}
          selectedId={selectedSeason?.id ?? ""}
        />
      </div>

      {!selectedSeason ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("emptyTitle")}
          description={t("noSeasons")}
        />
      ) : currentTeams.length === 0 ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead>{t("colRoster")}</TableHead>
              <TableHead>{t("colHealth")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">
                  {t("colActions")}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentTeams.map((team) => {
              const { alerts, hardCount, softCount } = computeRosterHealth(
                team.memberships,
                team,
              );
              const issues = healthIssueLines(alerts);
              return (
              <TableRow key={team.id}>
                <TableCell className="font-medium">
                  <Link href={`/equipos/${team.id}`} className="hover:underline">
                    {team.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {team.category ? t(`category.${team.category}`) : "—"}
                  {team.gender ? ` · ${t(`gender.${team.gender}`)}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {["player", "coach", "staff"].map((role) => {
                      const count = team.memberships.filter(
                        (m) => m.role === role,
                      ).length;
                      if (count === 0) return null;
                      const Icon =
                        role === "player"
                          ? UserIcon
                          : role === "coach"
                            ? UserCheckIcon
                            : BriefcaseIcon;
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
                    {team.memberships.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {issues.length === 0 ? (
                    <CheckIcon
                      className="size-4 text-muted-foreground"
                      aria-label={t("healthAllGood")}
                    />
                  ) : (
                    <Badge
                      variant={hardCount > 0 ? "destructive" : "secondary"}
                      className="gap-1"
                      title={issues.join(" · ")}
                    >
                      <TriangleAlertIcon className="size-3" />
                      {hardCount + softCount}
                    </Badge>
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className="flex justify-end gap-1">
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
                      }}
                    />
                    <DeleteTeamDialog id={team.id} name={team.name} />
                  </TableCell>
                ) : null}
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {canManage && selectedSeason ? (
        <div>
          <TeamDialog mode="create" seasonId={selectedSeason.id} />
        </div>
      ) : null}
    </div>
  );
}
