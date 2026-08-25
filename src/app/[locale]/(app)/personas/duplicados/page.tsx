import { ArrowLeftIcon, UsersRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { hasPermission, requirePermission } from "@/lib/auth";
import { findDuplicatePersonGroups } from "@/lib/person-matching";
import { Link } from "@/i18n/navigation";
import { MergeDuplicatesDialog } from "@/components/personas/merge-duplicates-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("personas") };
}

export default async function PersonDuplicatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("personas.view");
  const canManage = hasPermission(user, "personas.manage");
  const t = await getTranslations("Personas");

  const allPersons = await db.query.persons.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      email: true,
      phone: true,
      iban: true,
    },
    with: { memberships: { with: { team: true } } },
    orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
  });

  const candidates = findDuplicatePersonGroups(allPersons);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/personas" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToPersonas")}
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("duplicatesTitle")}
        </h1>
        <p className="text-muted-foreground">{t("duplicatesSubtitle")}</p>
      </div>

      {candidates.length === 0 ? (
        <SectionPlaceholder
          icon={UsersRound}
          title={t("noDuplicatesTitle")}
          description={t("noDuplicatesDescription")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {candidates.map((group, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {group.reasons.has("dni") ? (
                    <Badge variant="secondary">{t("matchByDni")}</Badge>
                  ) : null}
                  {group.reasons.has("name") ? (
                    <Badge variant="secondary">{t("matchByName")}</Badge>
                  ) : null}
                  {group.reasons.has("fuzzyName") ? (
                    <Badge variant="outline">{t("matchByFuzzyName")}</Badge>
                  ) : null}
                  {group.reasons.has("sharedContact") ? (
                    <Badge variant="outline">{t("matchBySharedContact")}</Badge>
                  ) : null}
                </CardTitle>
                {canManage ? (
                  <MergeDuplicatesDialog candidates={group.persons} />
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {group.persons.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <Link
                      href={`/personas/${person.id}?from=${encodeURIComponent("/personas/duplicados")}&fromLabel=${encodeURIComponent(t("duplicatesTitle"))}`}
                      className="font-medium hover:underline"
                    >
                      {person.firstName} {person.lastName}
                    </Link>
                    <span className="text-muted-foreground">
                      {person.nationalId ?? "—"}
                    </span>
                    <span className="text-muted-foreground">
                      {person.email ?? "—"}
                    </span>
                    <span className="text-muted-foreground">
                      {person.phone ?? "—"}
                    </span>
                    {person.memberships.map((m) => (
                      <Badge key={m.teamId} variant="secondary">
                        {m.team.name}
                      </Badge>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
