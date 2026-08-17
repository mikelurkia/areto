import { Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requireRole } from "@/lib/auth";
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
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Personas");
  const canManage = true;

  // Personas y equipos no dependen entre sí: en paralelo, para no pagar dos
  // idas y vueltas a la base de datos en serie.
  const [allPersons, allTeams] = await Promise.all([
    db.query.persons.findMany({
      orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
      with: {
        guardian: true,
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
  const teamOptions = allTeams.map((team) => ({
    id: team.id,
    label: teamSeasonLabel(team, team.season),
  }));

  const guardianOptions = allPersons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
  }));

  const dependentsCountByGuardianId = new Map<string, number>();
  for (const p of allPersons) {
    if (!p.guardianId) continue;
    dependentsCountByGuardianId.set(
      p.guardianId,
      (dependentsCountByGuardianId.get(p.guardianId) ?? 0) + 1,
    );
  }

  const personRows = allPersons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    birthDate: p.birthDate,
    nationalId: p.nationalId,
    isMember: p.isMember,
    memberNumber: p.memberNumber,
    address: p.address,
    city: p.city,
    iban: p.iban,
    guardianId: p.guardianId,
    medicalCertUntil: p.medicalCertUntil,
    shirtSize: p.shirtSize,
    pantsSize: p.pantsSize,
    shoeSize: p.shoeSize,
    photoConsent: p.photoConsent,
    notes: p.notes,
    guardian: p.guardian
      ? { firstName: p.guardian.firstName, lastName: p.guardian.lastName }
      : null,
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
    dependentsCount: dependentsCountByGuardianId.get(p.id) ?? 0,
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
