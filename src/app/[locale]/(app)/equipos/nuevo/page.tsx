import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { seasons } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { TeamForm } from "@/components/equipos/team-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Equipos" });
  return { title: t("newTeamTitle") };
}

export default async function NewTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { locale } = await params;
  const { season: seasonParam } = await searchParams;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("equipos.manage");
  const t = await getTranslations("Equipos");

  const allSeasons = await db.query.seasons.findMany({
    orderBy: desc(seasons.name),
  });
  const selectedSeason =
    allSeasons.find((s) => s.id === seasonParam) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];
  // Sin temporadas no hay dónde crear el equipo; la lista ya oculta el botón
  // de crear en ese caso, así que llegar aquí sin temporada es un caso raro.
  if (!selectedSeason) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        size="compact"
        back={{ href: `/equipos?season=${selectedSeason.id}`, label: t("backToTeams") }}
        title={t("newTeamTitle")}
        description={selectedSeason.name}
      />

      <Card>
        <CardContent>
          <TeamForm mode="create" seasonId={selectedSeason.id} />
        </CardContent>
      </Card>
    </div>
  );
}
