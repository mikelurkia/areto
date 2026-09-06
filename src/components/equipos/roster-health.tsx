"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type RosterHealthStats = {
  players: number;
  goalkeepers: number;
  coaches: number;
  avgAge: number | null;
};

export type RosterHealthAlerts = {
  duplicateJerseys: number[];
  noJersey: number;
  medicalExpired: number;
  medicalExpiring: number;
  ageOutOfRange: number;
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
}: {
  stats: RosterHealthStats;
  alerts: RosterHealthAlerts;
}) {
  const t = useTranslations("Equipos");

  const alertBadges: React.ReactNode[] = [];
  if (alerts.duplicateJerseys.length > 0) {
    alertBadges.push(
      <Badge key="dup" variant="destructive">
        {t("healthDuplicateJerseys", {
          numbers: alerts.duplicateJerseys.join(", "),
        })}
      </Badge>,
    );
  }
  if (alerts.ageOutOfRange > 0) {
    alertBadges.push(
      <Badge key="age" variant="destructive">
        {t("healthAgeOutOfRange", { count: alerts.ageOutOfRange })}
      </Badge>,
    );
  }
  if (alerts.medicalExpired > 0) {
    alertBadges.push(
      <Badge key="medexp" variant="destructive">
        {t("healthMedicalExpired", { count: alerts.medicalExpired })}
      </Badge>,
    );
  }
  if (alerts.medicalExpiring > 0) {
    alertBadges.push(
      <Badge key="medsoon" variant="secondary">
        {t("healthMedicalExpiring", { count: alerts.medicalExpiring })}
      </Badge>,
    );
  }
  if (alerts.noJersey > 0) {
    alertBadges.push(
      <Badge key="nojersey" variant="secondary">
        {t("healthNoJersey", { count: alerts.noJersey })}
      </Badge>,
    );
  }

  return (
    <Card size="sm" className="flex-row flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing)">
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
    </Card>
  );
}
