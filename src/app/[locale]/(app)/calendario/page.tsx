import { CalendarDays } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requireRole } from "@/lib/auth";
import { getCoachTeamIds, getWeekendKey, loadCourtEvents } from "@/lib/court-events";
import { CalendarioFilters } from "@/components/calendario/calendario-filters";
import { CourtEventDialog } from "@/components/calendario/court-event-dialog";
import { DeleteCourtEventDialog } from "@/components/calendario/delete-court-event-dialog";
import { PrintButton } from "@/components/print-button";
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
  return { title: t("calendario") };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "14 de febrero – 15 de febrero 2026" a partir del sábado del fin de semana. */
function formatWeekendRange(weekendOf: string, locale: string): string {
  const saturday = new Date(`${weekendOf}T00:00:00`);
  const sunday = new Date(saturday);
  sunday.setDate(sunday.getDate() + 1);
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  return `${dayMonth.format(saturday)} – ${dayMonth.format(sunday)} ${saturday.getFullYear()}`;
}

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requireRole(["admin", "staff", "coach"]);
  const t = await getTranslations("Calendario");
  const canManage = user.role === "admin" || user.role === "staff";

  const { team: teamParam, from: fromParam, to: toParam } = await searchParams;

  const today = new Date();
  const from = fromParam || toDateInputValue(today);
  const to = toParam || toDateInputValue(addMonths(today, 2));

  const [allTeams, coachTeamIds, events] = await Promise.all([
    db.query.teams.findMany({
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
    user.role === "coach" ? getCoachTeamIds(user.personId) : Promise.resolve(null),
    loadCourtEvents({ from, to, teamId: teamParam || undefined }),
  ]);

  // Igual que en Personas: el selector de equipo se limita a la temporada
  // activa, no a todo el histórico.
  const currentSeasonTeams = allTeams.filter((team) => team.season.isCurrent);
  const dialogTeams = (
    canManage
      ? currentSeasonTeams
      : currentSeasonTeams.filter((team) => coachTeamIds?.has(team.id))
  ).map((team) => ({ id: team.id, name: team.name }));

  function canManageRow(teamId: string | null) {
    if (canManage) return true;
    if (!teamId || !coachTeamIds) return false;
    return coachTeamIds.has(teamId);
  }

  // Agrupar por fin de semana (por si algún partido se tecleó con la fecha
  // del domingo en vez del sábado, ver `getWeekendKey`).
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const key = getWeekendKey(event.weekendOf);
    const group = groups.get(key);
    if (group) group.push(event);
    else groups.set(key, [event]);
  }
  const sortedWeekends = [...groups.keys()].sort();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <PrintButton label={t("printAction")} />
      </div>

      <CalendarioFilters
        teams={currentSeasonTeams.map((team) => ({ id: team.id, name: team.name }))}
        selectedTeamId={teamParam ?? ""}
        from={from}
        to={to}
      />

      {sortedWeekends.length === 0 ? (
        <SectionPlaceholder
          icon={CalendarDays}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        >
          {dialogTeams.length > 0 ? (
            <CourtEventDialog mode="create" teams={dialogTeams} />
          ) : null}
        </SectionPlaceholder>
      ) : (
        <div className="flex flex-col gap-6">
          {sortedWeekends.map((weekendKey) => {
            const rows = groups.get(weekendKey)!;
            return (
              <div key={weekendKey} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("weekendHeading", { range: formatWeekendRange(weekendKey, locale) })}
                </h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colTeam")}</TableHead>
                      <TableHead>{t("colHomeAway")}</TableHead>
                      <TableHead>{t("colOpponent")}</TableHead>
                      <TableHead>{t("colPreferredDay")}</TableHead>
                      <TableHead>{t("colNotes")}</TableHead>
                      <TableHead className="text-right print:hidden">
                        {t("colActions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((event) => {
                      const editable = canManageRow(event.teamId);
                      return (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.team?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={event.isHome ? "secondary" : "outline"}>
                              {event.isHome ? t("homeAway.home") : t("homeAway.away")}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.opponent ?? "—"}</TableCell>
                          <TableCell>
                            {event.preferredDay ? (
                              <Badge variant="outline">
                                {t(`preferredDay.${event.preferredDay}`)}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.notes ?? "—"}
                          </TableCell>
                          <TableCell className="flex justify-end gap-1 print:hidden">
                            {editable ? (
                              <>
                                <CourtEventDialog
                                  mode="edit"
                                  teams={dialogTeams}
                                  event={{
                                    id: event.id,
                                    teamId: event.teamId ?? "",
                                    teamName: event.team?.name ?? "",
                                    weekendOf: event.weekendOf,
                                    isHome: event.isHome,
                                    opponent: event.opponent,
                                    preferredDay: event.preferredDay,
                                    notes: event.notes,
                                  }}
                                />
                                <DeleteCourtEventDialog id={event.id} />
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      {sortedWeekends.length > 0 && dialogTeams.length > 0 ? (
        <div className="print:hidden">
          <CourtEventDialog mode="create" teams={dialogTeams} />
        </div>
      ) : null}
    </div>
  );
}
