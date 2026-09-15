"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ROSTER_FILTER_DEFAULTS } from "@/components/equipos/roster-table";
import { useFilterParams } from "@/hooks/use-filter-params";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type RosterHealthStats = {
  players: number;
  goalkeepers: number;
  coaches: number;
  avgAge: number | null;
};

export type RosterHealthAlerts = {
  duplicateJerseys: number[];
  duplicateJerseyIds: string[];
  noJersey: number;
  noJerseyIds: string[];
  medicalExpired: number;
  medicalExpiredIds: string[];
  medicalExpiring: number;
  medicalExpiringIds: string[];
  ageOutOfRange: number;
  ageOutOfRangeIds: string[];
};

/** Cifra y etiqueta en línea: el resumen es una franja, no un panel. */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function RosterHealth({
  stats,
  alerts,
  bare,
  className,
}: {
  stats: RosterHealthStats;
  alerts: RosterHealthAlerts;
  /** Sin `Card` propio, para incrustarla en un contenedor que ya la aporta. */
  bare?: boolean;
  className?: string;
}) {
  const t = useTranslations("Equipos");
  const [, setRosterFilters] = useFilterParams(ROSTER_FILTER_DEFAULTS, { navigate: false });

  /**
   * Cada aviso enlaza a la fila que lo causa: pone el filtro `foco` (leído por
   * `RosterTable`) en vez de solo describir el problema en un tooltip, para no
   * dejar al usuario buscando a mano a quién le falta el dorsal o el médico.
   */
  function focusOn(ids: string[], vista: "roster" | "medico") {
    setRosterFilters({ vista, foco: ids.join(",") });
  }

  const alertBadges: React.ReactNode[] = [];
  if (alerts.duplicateJerseys.length > 0) {
    alertBadges.push(
      <AlertButton key="dup" onClick={() => focusOn(alerts.duplicateJerseyIds, "roster")}>
        <Badge variant="destructive">
          {t("healthDuplicateJerseys", {
            numbers: alerts.duplicateJerseys.join(", "),
          })}
        </Badge>
      </AlertButton>,
    );
  }
  if (alerts.ageOutOfRange > 0) {
    alertBadges.push(
      <AlertButton key="age" onClick={() => focusOn(alerts.ageOutOfRangeIds, "roster")}>
        <Badge variant="destructive">
          {t("healthAgeOutOfRange", { count: alerts.ageOutOfRange })}
        </Badge>
      </AlertButton>,
    );
  }
  if (alerts.medicalExpired > 0) {
    alertBadges.push(
      <AlertButton key="medexp" onClick={() => focusOn(alerts.medicalExpiredIds, "medico")}>
        <Badge variant="destructive">
          {t("healthMedicalExpired", { count: alerts.medicalExpired })}
        </Badge>
      </AlertButton>,
    );
  }
  if (alerts.medicalExpiring > 0) {
    alertBadges.push(
      <AlertButton key="medsoon" onClick={() => focusOn(alerts.medicalExpiringIds, "medico")}>
        <Badge variant="secondary">
          {t("healthMedicalExpiring", { count: alerts.medicalExpiring })}
        </Badge>
      </AlertButton>,
    );
  }
  if (alerts.noJersey > 0) {
    alertBadges.push(
      <AlertButton key="nojersey" onClick={() => focusOn(alerts.noJerseyIds, "roster")}>
        <Badge variant="secondary">{t("healthNoJersey", { count: alerts.noJersey })}</Badge>
      </AlertButton>,
    );
  }

  const content = (
    <>
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Stat label={t("healthPlayers")} value={stats.players} />
        <Stat label={t("healthGoalkeepers")} value={stats.goalkeepers} />
        <Stat label={t("healthCoaches")} value={stats.coaches} />
        <Stat
          label={t("healthAvgAge")}
          value={stats.avgAge !== null ? stats.avgAge : "—"}
        />
      </dl>
      {alertBadges.length > 0 ? (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <TriangleAlertIcon className="size-3.5 text-muted-foreground" />
          {alertBadges}
        </div>
      ) : (
        <p className="ml-auto text-xs text-muted-foreground">{t("healthAllGood")}</p>
      )}
    </>
  );

  if (bare) {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
        {content}
      </div>
    );
  }

  return (
    <Card
      size="sm"
      className={cn("flex-row flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing)", className)}
    >
      {content}
    </Card>
  );
}

/** Envuelve un `Badge` en un botón real, sin tocar sus estilos. */
function AlertButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-4xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
