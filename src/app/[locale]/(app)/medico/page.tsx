import { Stethoscope } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import type { MedicalPanelRow } from "@/lib/medical-panel-rows";
import { teamSeasonLabel } from "@/lib/team-label";
import { categoryRequiresMedicalCheckup } from "@/components/equipos/team-categories";
import { MedicalPanelBrowser } from "@/components/medico/medical-panel-browser";
import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("medico") };
}

/**
 * Restringido a admin/staff, igual que `/personas`: agrega datos médicos de
 * todo el club (certificados y partes de lesión), no solo de un equipo.
 */
export default async function MedicoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("personas.medical.view");
  const t = await getTranslations("Medico");

  const [allPersons, allTeams] = await Promise.all([
    db.query.persons.findMany({
      // `birthDate`/`nationalId` no se pintan en la tabla: los piden las
      // exportaciones (listado imprimible y CSV), que salen de estas filas.
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        nationalId: true,
        medicalCertUntil: true,
      },
      with: {
        memberships: {
          columns: { role: true },
          with: {
            team: {
              columns: { id: true, name: true, category: true },
              with: { season: { columns: { isCurrent: true } } },
            },
          },
        },
        injuryReports: {
          columns: { id: true, occurredOn: true, description: true },
          orderBy: (r, { desc }) => [desc(r.occurredOn)],
        },
      },
    }),
    db.query.teams.findMany({
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
  ]);

  const teamOptions = allTeams
    .filter((team) => team.season.isCurrent)
    .map((team) => ({ id: team.id, label: teamSeasonLabel(team, team.season) }));

  // Alcance del panel: entrenadores, staff y jugadores con ficha en un equipo
  // de la temporada activa (cualquier rol), no solo jugadores. Quien nunca
  // tuvo equipo, o solo tuvo en temporadas pasadas, no genera ruido aquí.
  const inScopePersons = allPersons.filter((p) =>
    p.memberships.some((m) => m.team.season.isCurrent),
  );

  const certRows: MedicalPanelRow[] = inScopePersons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate,
    nationalId: p.nationalId,
    medicalCertUntil: p.medicalCertUntil,
    teams: p.memberships
      .filter((m) => m.team.season.isCurrent)
      .map((m) => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role,
        requiresMedicalCheckup: categoryRequiresMedicalCheckup(m.team.category),
      })),
  }));

  const injuryRows = inScopePersons
    .flatMap((p) =>
      p.injuryReports.map((r) => ({
        id: r.id,
        personId: p.id,
        personName: `${p.firstName} ${p.lastName}`,
        occurredOn: r.occurredOn,
        description: r.description,
        teams: p.memberships
          .filter((m) => m.team.season.isCurrent)
          .map((m) => ({ id: m.team.id, name: m.team.name })),
      })),
    )
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {certRows.length === 0 ? (
        <SectionPlaceholder
          icon={Stethoscope}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <MedicalPanelBrowser certRows={certRows} injuryRows={injuryRows} teamOptions={teamOptions} />
      )}
    </div>
  );
}
