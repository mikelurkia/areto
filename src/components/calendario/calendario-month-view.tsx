import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getWeekdayLabels, type MonthGridDay } from "@/lib/calendar-grid";
import { getWeekendKey } from "@/lib/court-events";
import { CourtEventDialog } from "@/components/calendario/court-event-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TeamOption = { id: string; name: string };

export type MonthViewEvent = {
  id: string;
  teamId: string | null;
  teamName: string;
  weekendOf: string;
  isHome: boolean | null;
  opponent: string | null;
  preferredDay: string | null;
  notes: string | null;
};

export async function CalendarioMonthView({
  weeks,
  eventsByDate,
  dialogTeams,
  isEditable,
  locale,
}: {
  weeks: MonthGridDay[][];
  eventsByDate: Map<string, MonthViewEvent[]>;
  dialogTeams: TeamOption[];
  isEditable: (event: MonthViewEvent) => boolean;
  locale: string;
}) {
  const t = await getTranslations("Calendario");
  const weekdayLabels = getWeekdayLabels(locale);
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });

  return (
    <div className="overflow-x-auto print:hidden">
      <div className="grid min-w-[42rem] grid-cols-7 gap-px rounded-lg border border-border bg-border text-sm">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="bg-muted px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
        {weeks.flat().map((day, index) => {
          const isSaturday = index % 7 === 5;
          const isSunday = index % 7 === 6;
          // Los partidos se agrupan por el sábado del fin de semana (ver
          // `getWeekendKey`); en domingo hay que resolver la clave del grupo
          // a partir de la fecha del propio domingo.
          const weekendEvents = isSaturday
            ? eventsByDate.get(day.date) ?? []
            : isSunday
              ? eventsByDate.get(getWeekendKey(day.date)) ?? []
              : [];
          // Cada partido se muestra en el día que pide el equipo: domingo si
          // `preferredDay` es "sunday", sábado en cualquier otro caso
          // (sábado, indiferente o sin preferencia).
          const events = weekendEvents.filter((event) =>
            isSunday ? event.preferredDay === "sunday" : event.preferredDay !== "sunday",
          );
          const dayNumber = Number(day.date.slice(8, 10));
          const canCreate = isSaturday && weekendEvents.length === 0 && dialogTeams.length > 0;

          return (
            <div
              key={day.date}
              className={cn(
                "flex min-h-24 flex-col gap-1 bg-background p-1.5",
                !day.inCurrentMonth && "bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "text-xs",
                  day.inCurrentMonth ? "text-muted-foreground" : "text-muted-foreground/50",
                )}
              >
                {dayNumber}
              </span>
              {events.map((event) => {
                const label = [event.teamName, event.opponent].filter(Boolean).join(" vs ");
                if (event.isHome === true && isEditable(event)) {
                  return (
                    <CourtEventDialog
                      key={event.id}
                      mode="edit"
                      teams={dialogTeams}
                      event={{
                        id: event.id,
                        teamId: event.teamId ?? "",
                        teamName: event.teamName,
                        weekendOf: event.weekendOf,
                        isHome: event.isHome,
                        opponent: event.opponent,
                        preferredDay: event.preferredDay,
                        notes: event.notes,
                      }}
                      triggerRender={
                        <Badge
                          variant="secondary"
                          className="w-full cursor-pointer justify-start truncate"
                        />
                      }
                      triggerChildren={label}
                    />
                  );
                }
                return (
                  <Badge key={event.id} variant="outline" className="w-full justify-start truncate">
                    {label}
                  </Badge>
                );
              })}
              {canCreate ? (
                <CourtEventDialog
                  mode="create"
                  teams={dialogTeams}
                  defaultWeekendOf={day.date}
                  dialogKey={`partido-nuevo:${day.date}`}
                  triggerRender={
                    <Badge
                      variant="outline"
                      className="w-full cursor-pointer justify-center border-dashed text-muted-foreground"
                    />
                  }
                  triggerChildren={
                    <>
                      <PlusIcon className="size-3" />
                      <span className="sr-only">
                        {t("addMatchSr", { date: dateFormatter.format(new Date(`${day.date}T00:00:00`)) })}
                      </span>
                    </>
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
