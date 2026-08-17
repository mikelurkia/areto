import { ArrowLeftIcon, UsersRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requireRole } from "@/lib/auth";
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

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default async function PersonDuplicatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Personas");

  const allPersons = await db.query.persons.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      email: true,
      phone: true,
    },
    with: { memberships: { with: { team: true } } },
    orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
  });

  const byDni = new Map<string, typeof allPersons>();
  const byName = new Map<string, typeof allPersons>();
  for (const person of allPersons) {
    if (person.nationalId) {
      const key = person.nationalId.trim().toUpperCase();
      byDni.set(key, [...(byDni.get(key) ?? []), person]);
    }
    const nameKey = normalizeName(`${person.firstName} ${person.lastName}`);
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), person]);
  }

  const groupsByKey = new Map<
    string,
    { persons: typeof allPersons; reasons: Set<"dni" | "name"> }
  >();
  function addGroup(group: typeof allPersons, reason: "dni" | "name") {
    if (group.length < 2) return;
    const key = [...group.map((p) => p.id)].sort().join(",");
    const existing = groupsByKey.get(key);
    if (existing) existing.reasons.add(reason);
    else groupsByKey.set(key, { persons: group, reasons: new Set([reason]) });
  }
  for (const group of byDni.values()) addGroup(group, "dni");
  for (const group of byName.values()) addGroup(group, "name");

  const candidates = [...groupsByKey.values()];

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
                </CardTitle>
                <MergeDuplicatesDialog candidates={group.persons} />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {group.persons.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <Link
                      href={`/personas/${person.id}`}
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
