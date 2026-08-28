import { CalendarDaysIcon } from "lucide-react";
import { desc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { SeasonDialog } from "@/components/temporada/season-dialog";
import { TemporadasBrowser } from "@/components/temporada/temporadas-browser";
import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("temporada") };
}

export default async function TemporadasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("temporadas.view");
  const t = await getTranslations("Temporadas");
  const canManage = hasPermission(user, "temporadas.manage");

  const allSeasons = await db.query.seasons.findMany({
    orderBy: desc(seasons.name),
    with: {
      teams: { columns: { id: true } },
    },
  });

  const rows = allSeasons.map((season) => ({
    id: season.id,
    name: season.name,
    isCurrent: season.isCurrent,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    teamsCount: season.teams.length,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={canManage ? <SeasonDialog mode="create" /> : null}
      />

      {allSeasons.length === 0 ? (
        <SectionPlaceholder
          icon={CalendarDaysIcon}
          title={t("noSeasonsTitle")}
          description={t("noSeasonsDescription")}
        >
          {canManage ? <SeasonDialog mode="create" /> : null}
        </SectionPlaceholder>
      ) : (
        <TemporadasBrowser seasons={rows} locale={locale} canManage={canManage} />
      )}
    </div>
  );
}
