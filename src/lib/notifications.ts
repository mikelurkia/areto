import "server-only";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { type CurrentUser, hasPermission } from "@/lib/auth";
import {
  countExpiringMedicalPlayers,
  countPendingRegistrations,
} from "@/lib/dashboard-alerts";
import {
  countDuplicatePersonGroups,
  loadDataIntegrityIssues,
} from "@/lib/data-integrity";
import { medicalReferenceDates } from "@/lib/medical-panel-rows";
import { loadSeasonRenewals } from "@/lib/season-renewals";

export type NotificationItem = {
  key: string;
  label: string;
  hint?: string;
  count: number;
  href: string;
  tone: "warning" | "danger";
};

/**
 * Mismas alertas que ya calcula el dashboard (`AlertsGrid` y `ReviewCard`),
 * reagrupadas para la campana. Deliberadamente sin `"use cache"` propio en
 * esta función: cada pieza ya trae su propia estrategia de caché (las de
 * `data-integrity.ts` la tienen, las de `dashboard-alerts.ts` no, a
 * propósito — ver sus comentarios), y aquí no se suma nada por encima.
 *
 * Se llama solo bajo demanda desde el cliente (al montar la campana o al
 * abrirla), nunca desde el árbol de render de una página: sumar esto al
 * `Promise.all` de cada página repetiría el patrón que ya colgó el
 * dashboard una vez (ver CLAUDE.md).
 */
export async function loadNotificationAlerts(user: CurrentUser): Promise<NotificationItem[]> {
  const canSeePersonas = hasPermission(user, "personas.view");
  if (!canSeePersonas) return [];
  const canSeeMedical = hasPermission(user, "personas.medical.view");

  const t = await getTranslations("Dashboard");
  const { today, cutoff } = medicalReferenceDates(new Date());

  const [registrationCounts, medical, currentSeason] = await Promise.all([
    countPendingRegistrations(),
    canSeeMedical
      ? countExpiringMedicalPlayers(today, cutoff)
      : Promise.resolve({ expired: 0, expiring: 0, total: 0 }),
    db.query.seasons.findFirst({ where: eq(seasons.isCurrent, true), columns: { id: true } }),
  ]);
  // Aparte del `Promise.all` anterior por el mismo motivo que en el
  // dashboard: es una agregación con sus propias queries internas.
  const renewals = currentSeason ? await loadSeasonRenewals(currentSeason.id) : null;
  const [issues, duplicatePersonsCount] = await Promise.all([
    loadDataIntegrityIssues(currentSeason?.id ?? null),
    countDuplicatePersonGroups(),
  ]);

  const items: NotificationItem[] = [];

  if (registrationCounts.player > 0) {
    items.push({
      key: "playerRegistrations",
      label: t("alerts.playerRegistrations"),
      count: registrationCounts.player,
      href: "/inscripciones",
      tone: "warning",
    });
  }
  if (registrationCounts.member > 0) {
    items.push({
      key: "memberRegistrations",
      label: t("alerts.memberRegistrations"),
      count: registrationCounts.member,
      href: "/socios",
      tone: "warning",
    });
  }
  if (renewals && renewals.missingCount > 0) {
    items.push({
      key: "missingRegistrations",
      label: t("alerts.missingRegistrations"),
      count: renewals.missingCount,
      href: `/temporadas/${currentSeason!.id}/pendientes`,
      tone: "warning",
    });
  }
  if (medical.total > 0) {
    items.push({
      key: "medicalCerts",
      label: t("alerts.medicalCerts"),
      hint: t("alerts.medicalBreakdown", {
        expired: medical.expired,
        expiring: medical.expiring,
      }),
      count: medical.total,
      href: "/medico?estado=needsUpdate",
      tone: medical.expired > 0 ? "danger" : "warning",
    });
  }
  for (const issue of issues) {
    items.push({
      key: issue.key,
      label: t(`review.${issue.key}`),
      count: issue.count,
      href: issue.href,
      tone: issue.severity === "hard" ? "danger" : "warning",
    });
  }
  if (duplicatePersonsCount > 0) {
    items.push({
      key: "duplicatePersons",
      label: t("review.duplicatePersons"),
      count: duplicatePersonsCount,
      href: "/personas/duplicados",
      tone: "warning",
    });
  }

  return items;
}
