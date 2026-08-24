import { Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import { isPastMember } from "@/lib/membership";
import { teamSeasonLabel } from "@/lib/team-label";
import { Link } from "@/i18n/navigation";
import { PersonasBrowser } from "@/components/personas/personas-browser";
import { PersonDialog } from "@/components/personas/person-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("personas") };
}

/**
 * Restringido a admin/staff: la ficha de persona incluye DNI, IBAN, dirección
 * y datos médicos de todo el club, no solo de quien consulta.
 */
export default async function PersonasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("personas.view");
  const t = await getTranslations("Personas");
  const canManage = true;

  // Personas y equipos no dependen entre sí: en paralelo, para no pagar dos
  // idas y vueltas a la base de datos en serie.
  const [allPersons, allTeams] = await Promise.all([
    db.query.persons.findMany({
      orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
      with: {
        guardianRows: {
          with: { guardian: { columns: { id: true, firstName: true, lastName: true } } },
          orderBy: (g, { desc }) => [desc(g.isPrimary)],
        },
        guardianOfRows: { columns: { id: true } },
        clubMember: { columns: { status: true, memberNumber: true } },
        memberships: { with: { team: { with: { season: true } } } },
        qualifications: { columns: { title: true, expiresOn: true } },
        tags: { columns: { tag: true } },
      },
    }),
    db.query.teams.findMany({
      with: { season: true },
      orderBy: (teams, { asc }) => [asc(teams.category), asc(teams.name)],
    }),
  ]);
  const teamOptions = allTeams
    .filter((team) => team.season.isCurrent)
    .map((team) => ({
      id: team.id,
      label: teamSeasonLabel(team, team.season),
    }));

  const guardianOptions = allPersons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate,
  }));

  const personRows = allPersons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    birthDate: p.birthDate,
    nationalId: p.nationalId,
    isMember: p.clubMember?.status === "active",
    memberNumber: p.clubMember?.memberNumber ?? null,
    address: p.address,
    city: p.city,
    iban: p.iban,
    medicalCertUntil: p.medicalCertUntil,
    shirtSize: p.shirtSize,
    pantsSize: p.pantsSize,
    shoeSize: p.shoeSize,
    photoConsent: p.photoConsent,
    sepaConsent: p.sepaConsent,
    notes: p.notes,
    guardians: p.guardianRows.map((r) => ({
      id: r.guardian.id,
      firstName: r.guardian.firstName,
      lastName: r.guardian.lastName,
    })),
    memberships: p.memberships.map((m) => ({
      teamId: m.teamId,
      role: m.role,
      jerseyNumber: m.jerseyNumber,
      team: { name: m.team.name },
    })),
    qualifications: p.qualifications.map((q) => ({
      title: q.title,
      expiresOn: q.expiresOn,
    })),
    tags: p.tags.map((t) => t.tag),
    dependentsCount: p.guardianOfRows.length,
    isPastMember: isPastMember(p.memberships),
  }));

  const tagOptions = [...new Set(allPersons.flatMap((p) => p.tags.map((t) => t.tag)))].sort();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/personas/duplicados" />}
              nativeButton={false}
            >
              {t("reviewDuplicatesAction")}
            </Button>
            <PersonDialog mode="create" guardianOptions={guardianOptions} />
          </div>
        ) : null}
      </div>

      {allPersons.length === 0 ? (
        <SectionPlaceholder
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <PersonasBrowser
          persons={personRows}
          teamOptions={teamOptions}
          guardianOptions={guardianOptions}
          tagOptions={tagOptions}
          canManage={canManage}
        />
      )}
    </div>
  );
}
