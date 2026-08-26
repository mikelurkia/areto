import { getLocale, getTranslations } from "next-intl/server";

import { formatWeekendRange } from "@/lib/court-events";
import type { UpcomingFixtures } from "@/lib/upcoming-fixtures";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Cuadro de la próxima jornada: el siguiente partido de cada equipo de la
 * temporada actual, agrupado por categoría. A diferencia del resto del panel,
 * aquí sí interesa el detalle deportivo (rival, local/visitante, fin de semana
 * y día preferido): no son datos personales, son el cuadro de la jornada.
 */
export async function FixtureBoard({ byCategory }: { byCategory: UpcomingFixtures["byCategory"] }) {
  const [t, tEquipos, tCalendario, locale] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Equipos"),
    getTranslations("Calendario"),
    getLocale(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {byCategory.map((group) => (
        <div key={group.category ?? "sin-categoria"} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.category
                ? tEquipos(`category.${group.category}`)
                : t("fixtureNoCategory")}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.teams.map(({ teamId, teamName, fixture }) => (
              <div
                key={teamId}
                className={cn(
                  "flex flex-col gap-2 rounded-lg p-3",
                  fixture
                    ? "bg-card ring-1 ring-foreground/10"
                    : "border border-dashed border-border text-muted-foreground",
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">{teamName}</span>
                {fixture ? (
                  <>
                    <span className="leading-tight font-semibold">
                      {fixture.opponent ?? t("fixtureUnknownOpponent")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {fixture.isHome === null ? null : (
                        <Badge variant={fixture.isHome ? "default" : "outline"}>
                          {fixture.isHome
                            ? tCalendario("homeAway.home")
                            : tCalendario("homeAway.away")}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {formatWeekendRange(fixture.weekendOf, locale, "short")}
                      </Badge>
                      {fixture.preferredDay ? (
                        <Badge variant="outline">
                          {tCalendario(`preferredDay.${fixture.preferredDay}`)}
                        </Badge>
                      ) : fixture.isHome === true ? (
                        <Badge variant="warning">{t("fixtureMissingPreferredDay")}</Badge>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <span className="text-sm">{t("fixtureNoMatch")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
