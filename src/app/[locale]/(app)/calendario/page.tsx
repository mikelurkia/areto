import { CalendarDays } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { hasPermission, requirePermission } from "@/lib/auth";
import {
  addMonths,
  formatMonthKey,
  getMonthGridWeeks,
  parseMonthKey,
  toDateInputValue,
} from "@/lib/calendar-grid";
import {
  canEditCourtEventBadge,
  formatWeekendRange,
  getCoachTeamIds,
  groupCourtEventsByWeekend,
  loadCourtEvents,
} from "@/lib/court-events";
import { CalendarioFilters } from "@/components/calendario/calendario-filters";
import { CalendarioMonthNav } from "@/components/calendario/calendario-month-nav";
import {
  CalendarioMonthView,
  type MonthViewEvent,
} from "@/components/calendario/calendario-month-view";
import { CalendarioViewToggle } from "@/components/calendario/calendario-view-toggle";
import { CourtEventDialog } from "@/components/calendario/court-event-dialog";
import { DeleteCourtEventDialog } from "@/components/calendario/delete-court-event-dialog";
import { PageHeader } from "@/components/page-header";
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

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    team?: string;
    from?: string;
    to?: string;
    view?: string;
    month?: string;
    away?: string;
  }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("calendario.view");
  const t = await getTranslations("Calendario");
  const canManage = hasPermission(user, "calendario.manage.all");

  const {
    team: teamParam,
    from: fromParam,
    to: toParam,
    view: viewParam,
    month: monthParam,
    away: awayParam,
  } = await searchParams;

  const view = viewParam === "month" ? "month" : "list";
  // Por defecto solo se muestran los partidos en casa: son los únicos que
  // hay que organizar con el polideportivo (ver `canEditCourtEventBadge`).
  const showAway = awayParam === "show";
  const today = new Date();
  const monthKey = formatMonthKey(parseMonthKey(view === "month" ? monthParam : undefined, today));

  let from: string;
  let to: string;
  let weeks: ReturnType<typeof getMonthGridWeeks> | null = null;
  if (view === "month") {
    weeks = getMonthGridWeeks(monthKey);
    from = weeks[0][0].date;
    to = weeks.at(-1)!.at(-1)!.date;
  } else {
    from = fromParam || toDateInputValue(today);
    to = toParam || toDateInputValue(addMonths(today, 2));
  }

  const [allTeams, coachTeamIds, loadedEvents] = await Promise.all([
    db.query.teams.findMany({
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
    // Solo hace falta para acotar a quien gestiona su(s) equipo(s): quien
    // gestiona todos no necesita la lista, y quien no gestiona nada tampoco.
    !canManage && hasPermission(user, "calendario.manage")
      ? getCoachTeamIds(user.personId)
      : Promise.resolve(null),
    loadCourtEvents({ from, to, teamId: teamParam || undefined }),
  ]);
  // Los partidos fuera de casa nunca son gestionables por el club (ver
  // `canEditCourtEventBadge`); el filtro permite ocultarlos para centrarse en
  // los que hay que organizar con el polideportivo.
  const events = showAway ? loadedEvents : loadedEvents.filter((event) => event.isHome === true);

  // Igual que en Personas: el selector de equipo se limita a la temporada
  // activa, no a todo el histórico.
  const currentSeasonTeams = allTeams.filter((team) => team.season.isCurrent);
  const dialogTeams = (
    canManage
      ? currentSeasonTeams
      : currentSeasonTeams.filter((team) => coachTeamIds?.has(team.id))
  ).map((team) => ({ id: team.id, name: team.name }));

  function isEditable(event: { teamId: string | null; isHome: boolean | null }) {
    return canEditCourtEventBadge(event, { canManage, coachTeamIds });
  }

  // Agrupar por fin de semana (por si algún partido se tecleó con la fecha
  // del domingo en vez del sábado, ver `getWeekendKey`).
  const groups = groupCourtEventsByWeekend(events);
  const sortedWeekends = [...groups.keys()].sort();
  // El primero es el próximo fin de semana con partidos dentro del rango
  // filtrado: el siguiente que hay que organizar con el polideportivo. Se
  // destaca aparte; el resto se agrupa en una única tabla para que quede
  // legible aunque haya muchos fines de semana.
  const [nextWeekendKey, ...restWeekendKeys] = sortedWeekends;

  function renderEventRowCells(event: (typeof events)[number]) {
    const editable = isEditable(event);
    return (
      <>
        <TableCell className="font-medium">{event.team?.name ?? "—"}</TableCell>
        <TableCell priority="secondary">
          <Badge variant={event.isHome ? "secondary" : "outline"}>
            {event.isHome ? t("homeAway.home") : t("homeAway.away")}
          </Badge>
        </TableCell>
        <TableCell>{event.opponent ?? "—"}</TableCell>
        <TableCell priority="tertiary">
          {event.preferredDay ? (
            <Badge variant="outline">{t(`preferredDay.${event.preferredDay}`)}</Badge>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell priority="tertiary" className="text-muted-foreground">
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
      </>
    );
  }

  const monthEvents: MonthViewEvent[] = events.map((event) => ({
    id: event.id,
    teamId: event.teamId,
    teamName: event.team?.name ?? "",
    weekendOf: event.weekendOf,
    isHome: event.isHome,
    opponent: event.opponent,
    preferredDay: event.preferredDay,
    notes: event.notes,
  }));
  const eventsByDate = groupCourtEventsByWeekend(monthEvents);

  return (
    /*
      `print:p-[14mm]` porque esta página imprime sin ser una `PrintableSheet`:
      `@page` ya no da margen (lo pone la hoja como padding), así que sin esto
      saldría a sangre.
    */
    <div className="flex flex-1 flex-col gap-6 print:p-[14mm]">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          view === "list" ? <PrintButton label={t("printAction")} /> : null
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <CalendarioFilters
          teams={currentSeasonTeams.map((team) => ({ id: team.id, name: team.name }))}
          selectedTeamId={teamParam ?? ""}
          from={from}
          to={to}
          view={view}
          showAway={showAway}
        />
        <div className="flex items-center gap-3 print:hidden">
          <CalendarioViewToggle view={view} team={teamParam} monthKey={monthKey} />
          {view === "month" ? (
            <CalendarioMonthNav monthKey={monthKey} team={teamParam} locale={locale} />
          ) : null}
        </div>
      </div>

      {view === "month" ? (
        <CalendarioMonthView
          weeks={weeks!}
          eventsByDate={eventsByDate}
          dialogTeams={dialogTeams}
          isEditable={isEditable}
          locale={locale}
        />
      ) : sortedWeekends.length === 0 ? (
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
          <div className="flex break-inside-avoid flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 print:border-none print:bg-transparent print:p-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
                {t("weekendHeading", { range: formatWeekendRange(nextWeekendKey, locale) })}
              </h2>
              <Badge className="print:hidden">{t("nextWeekendBadge")}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colTeam")}</TableHead>
                  <TableHead priority="secondary">{t("colHomeAway")}</TableHead>
                  <TableHead>{t("colOpponent")}</TableHead>
                  <TableHead priority="tertiary">{t("colPreferredDay")}</TableHead>
                  <TableHead priority="tertiary">{t("colNotes")}</TableHead>
                  <TableHead className="text-right print:hidden">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.get(nextWeekendKey)!.map((event) => (
                  <TableRow key={event.id}>{renderEventRowCells(event)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {restWeekendKeys.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase break-after-avoid">
                {t("laterMatchesHeading")}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colDate")}</TableHead>
                    <TableHead>{t("colTeam")}</TableHead>
                    <TableHead priority="secondary">{t("colHomeAway")}</TableHead>
                    <TableHead>{t("colOpponent")}</TableHead>
                    <TableHead priority="tertiary">{t("colPreferredDay")}</TableHead>
                    <TableHead priority="tertiary">{t("colNotes")}</TableHead>
                    <TableHead className="text-right print:hidden">{t("colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restWeekendKeys.flatMap((weekendKey) => {
                    const rows = groups.get(weekendKey)!;
                    return rows.map((event, rowIndex) => (
                      <TableRow
                        key={event.id}
                        className={rowIndex === 0 ? "border-t-2 border-t-border" : undefined}
                      >
                        {rowIndex === 0 ? (
                          <TableCell
                            rowSpan={rows.length}
                            className="align-top font-semibold text-primary bg-primary/5"
                          >
                            {formatWeekendRange(weekendKey, locale)}
                          </TableCell>
                        ) : null}
                        {renderEventRowCells(event)}
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      )}

      {view === "list" && sortedWeekends.length > 0 && dialogTeams.length > 0 ? (
        <div className="print:hidden">
          <CourtEventDialog mode="create" teams={dialogTeams} />
        </div>
      ) : null}
    </div>
  );
}
