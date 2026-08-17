import { CalendarDaysIcon } from "lucide-react";
import { desc } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import {
  DeleteSeasonDialog,
  SeasonDialog,
} from "@/components/temporada/season-dialog";
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

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("temporada") };
}

export default async function TemporadasPage() {
  const user = await requireUser();
  const t = await getTranslations("Temporadas");
  const locale = await getLocale();
  const canManage = user.role === "admin" || user.role === "staff";

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage ? <SeasonDialog mode="create" /> : null}
      </div>

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
