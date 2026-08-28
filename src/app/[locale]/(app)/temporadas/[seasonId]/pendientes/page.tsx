import { notFound } from "next/navigation";
import { ShieldHalf } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { loadSeasonRenewals } from "@/lib/season-renewals";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { SeasonRenewalsTable } from "@/components/temporadas/season-renewals-table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
}) {
  const { locale, seasonId } = await params;
  const t = await getTranslations({ locale, namespace: "Temporadas" });
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  return { title: `${t("renewalsPageTitle")} · ${season?.name ?? "Areto"}` };
}

export default async function SeasonRenewalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale, seasonId } = await params;
  const { team: teamFilter } = await searchParams;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("temporadas.view");
  const t = await getTranslations("Temporadas");

  // `loadSeasonRenewals` va en un await aparte: es una agregación con su
  // propio Promise.all interno, y sumarla al de esta página sería el mismo
  // patrón que colgó el dashboard (ver CLAUDE.md).
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  if (!season) notFound();
  const renewals = await loadSeasonRenewals(seasonId);

  const filteredRows = teamFilter
    ? renewals.rows.filter((r) => r.teamId === teamFilter)
    : renewals.rows;
  const filteredTeamName = teamFilter ? filteredRows[0]?.teamName : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        back={{
          href: `/temporadas/${season.id}`,
          label: t("backToSeason"),
        }}
        title={t("renewalsPageTitle")}
        description={`${season.name}${
          filteredTeamName ? ` · ${filteredTeamName}` : ""
        } · ${t("renewalsPageDescription")}`}
      />

      {filteredRows.length === 0 ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("noRenewalsPendingTitle")}
          description={t("noRenewalsPendingDescription")}
        />
      ) : (
        <SeasonRenewalsTable
          rows={filteredRows}
          seasonId={season.id}
          seasonName={season.name}
          locale={locale}
        />
      )}
    </div>
  );
}
