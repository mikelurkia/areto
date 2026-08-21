import { cache } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  BellIcon,
  BriefcaseIcon,
  ShieldHalf,
  UserCheckIcon,
  UserIcon,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons, teams } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadSeasonRenewals } from "@/lib/season-renewals";
import { Link } from "@/i18n/navigation";
import { DeleteSeasonDialog, SeasonDialog } from "@/components/temporada/season-dialog";
import { ImportTeamsDialog } from "@/components/temporada/import-teams-dialog";
import { TeamDialog } from "@/components/equipos/team-dialog";
import { DeleteTeamDialog } from "@/components/equipos/delete-team-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** En `cache()`: la piden `generateMetadata` y la página en el mismo render. */
const getSeason = cache((seasonId: string) =>
  db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
}) {
  const { seasonId } = await params;
  const season = await getSeason(seasonId);
  return { title: season?.name ?? "Areto" };
}

export default async function TemporadaDetailPage({
  params,
}: {
  params: Promise<{ locale: string; seasonId: string }>;
}) {
  const { locale, seasonId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Temporadas");
  const tEquipos = await getTranslations("Equipos");
  const canManage = user.role === "admin" || user.role === "staff";

  // Las tres consultas de la temporada se resuelven con el `seasonId` de la
  // URL, así que van en paralelo. `loadSeasonRenewals` va aparte: por debajo
  // dispara sus propias queries (cruza plantilla e inscripciones), y sumarlas
  // al mismo `Promise.all` es justo el patrón de concurrencia que causó el
  // cuelgue del dashboard — como ya está cacheada (`"use cache"`), el coste
  // real de secuenciarla solo se paga en cache-miss.
  const [season, seasonTeams, allSeasons] = await Promise.all([
    getSeason(seasonId),
    db.query.teams.findMany({
      where: eq(teams.seasonId, seasonId),
      orderBy: (tm, { asc }) => [asc(tm.category), asc(tm.name)],
      with: {
        memberships: { columns: { role: true } },
      },
    }),
    canManage
      ? db.query.seasons.findMany({
          orderBy: (s, { desc }) => [desc(s.name)],
          with: {
            teams: { columns: { id: true, name: true, category: true, gender: true } },
          },
        })
      : [],
  ]);
  if (!season) notFound();
  const renewals = await loadSeasonRenewals(seasonId);

  // Temporadas de origen para "traer equipos en lote": las demás temporadas con
  // al menos un equipo. Marcamos los que ya se trajeron a esta (previousTeamId).
  const importedFrom = new Set(
    seasonTeams
      .map((tm) => tm.previousTeamId)
      .filter((id): id is string => id !== null),
  );
  const otherSeasons = allSeasons.filter((s) => s.id !== season.id);
  const categoryGenderLabel = (category: string | null, gender: string | null) =>
    [
      category ? tEquipos(`category.${category}`) : null,
      gender ? tEquipos(`gender.${gender}`) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const sourceSeasons = otherSeasons
    .filter((s) => s.teams.length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      teams: [...s.teams]
        .sort((a, b) => a.name.localeCompare(b.name, locale))
        .map((tm) => ({
          id: tm.id,
          name: tm.name,
          label: categoryGenderLabel(tm.category, tm.gender),
          alreadyImported: importedFrom.has(tm.id),
        })),
    }));

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00`));
  const starts = season.startsOn ? fmtDate(season.startsOn) : null;
  const ends = season.endsOn ? fmtDate(season.endsOn) : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Link
          href="/temporadas"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("backToSeasons")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{season.name}</h1>
              {season.isCurrent ? <Badge variant="secondary">{t("currentBadge")}</Badge> : null}
            </div>
            <p className="text-muted-foreground">
              {starts || ends ? `${starts ?? "—"} – ${ends ?? "—"} · ` : ""}
              {t("fichaSubtitle")}
            </p>
          </div>
          {canManage ? (
            <div className="flex items-center gap-1">
              <SeasonDialog mode="edit" season={season} />
              <DeleteSeasonDialog id={season.id} name={season.name} />
            </div>
          ) : null}
        </div>
      </div>

      {renewals.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <BellIcon className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("renewalsSectionTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {renewals.missingCount > 0
                  ? t("renewalsSummary", { missing: renewals.missingCount, total: renewals.total })
                  : t("renewalsAllDone")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/temporadas/${season.id}/pendientes`} />}
            nativeButton={false}
          >
            {t("viewRenewalsAction")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("teamsSection")}
        </h2>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {sourceSeasons.length > 0 ? (
              <ImportTeamsDialog targetSeasonId={season.id} sourceSeasons={sourceSeasons} />
            ) : null}
            <TeamDialog mode="create" seasonId={season.id} />
          </div>
        ) : null}
      </div>

      {seasonTeams.length === 0 ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("noTeamsTitle")}
          description={canManage ? t("noTeamsDescription") : t("noTeamsReadonly")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tEquipos("colName")}</TableHead>
              <TableHead>{tEquipos("colCategory")}</TableHead>
              <TableHead>{tEquipos("colRoster")}</TableHead>
              {canManage ? (
                <TableHead className="text-right">{tEquipos("colActions")}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasonTeams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/equipos/${team.id}?from=${encodeURIComponent(`/temporadas/${season.id}`)}&fromLabel=${encodeURIComponent(season.name)}`}
                    className="hover:underline"
                  >
                    {team.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {team.category ? tEquipos(`category.${team.category}`) : "—"}
                  {team.gender ? ` · ${tEquipos(`gender.${team.gender}`)}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {["player", "coach", "staff"].map((role) => {
                      const count = team.memberships.filter((m) => m.role === role).length;
                      if (count === 0) return null;
                      const Icon =
                        role === "player"
                          ? UserIcon
                          : role === "coach"
                            ? UserCheckIcon
                            : BriefcaseIcon;
                      return (
                        <Badge
                          key={role}
                          variant="secondary"
                          className="gap-1"
                          title={tEquipos(`roleOption.${role}`)}
                        >
                          <Icon className="size-3" />
                          {count}
                        </Badge>
                      );
                    })}
                    {team.memberships.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </TableCell>
                {canManage ? (
                  <TableCell className="flex justify-end gap-1">
                    <TeamDialog
                      mode="edit"
                      team={{
                        id: team.id,
                        name: team.name,
                        category: team.category,
                        gender: team.gender,
                        minBirthYear: team.minBirthYear,
                        maxBirthYear: team.maxBirthYear,
                        federationGroup: team.federationGroup,
                        federationCode: team.federationCode,
                      }}
                    />
                    <DeleteTeamDialog id={team.id} name={team.name} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
