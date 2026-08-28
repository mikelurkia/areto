import { CalendarDaysIcon } from "lucide-react";
import { desc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import {
  DeleteSeasonDialog,
  SeasonDialog,
} from "@/components/temporada/season-dialog";
import { PageHeader } from "@/components/page-header";
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

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtDate = (d: string | null) => (d ? dateFmt.format(new Date(`${d}T00:00:00`)) : null);

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colDates")}</TableHead>
              <TableHead>{t("colTeams")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">{t("colActions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allSeasons.map((season) => {
              const starts = fmtDate(season.startsOn);
              const ends = fmtDate(season.endsOn);
              return (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">
                    <Link href={`/temporadas/${season.id}`} className="hover:underline">
                      {season.name}
                    </Link>
                    {season.isCurrent ? (
                      <Badge variant="secondary" className="ml-2">
                        {t("currentBadge")}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {starts || ends ? `${starts ?? "—"} – ${ends ?? "—"}` : "—"}
                  </TableCell>
                  <TableCell>{season.teams.length}</TableCell>
                  {canManage ? (
                    <TableCell className="flex justify-end gap-1">
                      <SeasonDialog mode="edit" season={season} />
                      <DeleteSeasonDialog id={season.id} name={season.name} />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
