import { ShieldHalf } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons, teams } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { computeRosterHealth } from "@/lib/roster-health";
import { SeasonSelect } from "@/components/equipos/season-select";
import { TeamDialog } from "@/components/equipos/team-dialog";
import { EquiposBrowser } from "@/components/equipos/equipos-browser";
import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("equipos") };
}

export default async function EquiposPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("equipos.view");
  const t = await getTranslations("Equipos");
  const canManage = hasPermission(user, "equipos.manage");

  // Los equipos sí dependen de la temporada elegida, pero el parámetro de la URL
  // y el listado de temporadas se pueden resolver a la vez.
  const [{ season: seasonParam }, allSeasons] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
  ]);

  const selectedSeason =
    allSeasons.find((s) => s.id === seasonParam) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const currentTeams = selectedSeason
    ? await db.query.teams.findMany({
        where: eq(teams.seasonId, selectedSeason.id),
        orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
        with: {
          memberships: {
            with: {
              person: {
                columns: {
                  birthDate: true,
                  medicalCertUntil: true,
                },
              },
            },
          },
        },
      })
    : [];

  // Fila lista para el componente cliente: la salud de la plantilla se calcula
  // aquí (necesita las fechas de nacimiento/certificado, que no hace falta
  // mandar al cliente), pero el texto de los avisos se traduce en el cliente
  // (mismo patrón que `RosterHealth`), así que solo pasamos `alerts`.
  const rows = currentTeams.map((team) => {
    const { alerts, hardCount, softCount } = computeRosterHealth(team.memberships, team);
    return {
      id: team.id,
      name: team.name,
      category: team.category,
      gender: team.gender,
      minBirthYear: team.minBirthYear,
      maxBirthYear: team.maxBirthYear,
      federationGroup: team.federationGroup,
      federationCode: team.federationCode,
      playerFeeCents: team.playerFeeCents,
      playerFeePeriod: team.playerFeePeriod,
      playerFeeNotes: team.playerFeeNotes,
      roster: team.memberships.map((m) => ({ role: m.role })),
      alerts,
      hardCount,
      softCount,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <SeasonSelect
            seasons={allSeasons}
            selectedId={selectedSeason?.id ?? ""}
          />
          {canManage && selectedSeason ? (
            <TeamDialog mode="create" seasonId={selectedSeason.id} />
          ) : null}
        </div>
      </div>

      {!selectedSeason ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("emptyTitle")}
          description={t("noSeasons")}
        />
      ) : rows.length === 0 ? (
        <SectionPlaceholder
          icon={ShieldHalf}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <EquiposBrowser teams={rows} locale={locale} canManage={canManage} />
      )}
    </div>
  );
}
