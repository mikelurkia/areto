"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

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
  formMissing: number;
  ageOutOfRange: number;
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
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
  if (alerts.formMissing > 0) {
    alertBadges.push(
      <Badge key="form" variant="secondary">
        {t("healthFormMissing", { count: alerts.formMissing })}
      </Badge>,
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("healthPlayers")} value={stats.players} />
        <Stat label={t("healthGoalkeepers")} value={stats.goalkeepers} />
        <Stat label={t("healthCoaches")} value={stats.coaches} />
        <Stat
          label={t("healthAvgAge")}
          value={stats.avgAge !== null ? stats.avgAge : "—"}
        />
      </dl>
      {alertBadges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <TriangleAlertIcon className="size-4 text-muted-foreground" />
          {alertBadges}
        </div>
      ) : (
        <p className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
          {t("healthAllGood")}
        </p>
      )}
    </div>
  );
}
