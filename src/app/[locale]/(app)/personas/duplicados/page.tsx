import { ArrowLeftIcon, UsersRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requireRole } from "@/lib/auth";
import {
  isFuzzyLastNameMatch,
  isFuzzyNameMatch,
  isNicknameFirstNameMatch,
  normalizeName,
} from "@/lib/person-matching";
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

/** Compara IBANes ignorando espacios/mayúsculas, igual que `isValidIban`. */
function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
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
      iban: true,
    },
    with: { memberships: { with: { team: true } } },
    orderBy: (persons, { asc }) => [asc(persons.lastName), asc(persons.firstName)],
  });

  type MatchReason = "dni" | "name" | "fuzzyName" | "sharedContact";

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
    { persons: typeof allPersons; reasons: Set<MatchReason> }
  >();
  function addGroup(group: typeof allPersons, reasons: MatchReason[]) {
    if (group.length < 2) return;
    const key = [...group.map((p) => p.id)].sort().join(",");
    const existing = groupsByKey.get(key);
    if (existing) for (const r of reasons) existing.reasons.add(r);
    else groupsByKey.set(key, { persons: group, reasons: new Set(reasons) });
  }
  for (const group of byDni.values()) addGroup(group, ["dni"]);
  for (const group of byName.values()) addGroup(group, ["name"]);

  // Coincidencias por parecido ortográfico ("Urkia Kortabarria" / "Urquia
  // Cortabarria"): a diferencia de `byDni`/`byName`, no hay una clave exacta
  // por la que agrupar, así que se comparan todos los pares. Con el tamaño
  // de plantilla de un club (unos pocos cientos de personas como mucho) el
  // coste O(n²) es insignificante.
  for (let i = 0; i < allPersons.length; i++) {
    for (let j = i + 1; j < allPersons.length; j++) {
      const a = allPersons[i];
      const b = allPersons[j];
      const samePhone = Boolean(a.phone && b.phone && a.phone === b.phone);
      const sameIban = Boolean(
        a.iban && b.iban && normalizeIban(a.iban) === normalizeIban(b.iban),
      );
      const sharedContact = samePhone || sameIban;

      if (isFuzzyNameMatch(a, b)) {
        addGroup([a, b], sharedContact ? ["fuzzyName", "sharedContact"] : ["fuzzyName"]);
        continue;
      }

      if (!sharedContact) continue;

      // El apellido coincide (exacto o parecido) y comparten teléfono/IBAN,
      // pero el nombre es demasiado distinto en longitud para que
      // `isFuzzyNameMatch` lo trate como una errata (p. ej. "Eli" /
      // "Elisabeth"). Solo lo tratamos como posible duplicado si además hay
      // relación de diminutivo entre los nombres: sin ese requisito, dos
      // hermanos menores que comparten el teléfono de su tutor y el mismo
      // apellido de familia saltarían como "duplicados" entre ellos.
      const lastA = normalizeName(a.lastName);
      const lastB = normalizeName(b.lastName);
      const lastNameMatches = lastA === lastB || isFuzzyLastNameMatch(a, b);
      if (lastNameMatches && isNicknameFirstNameMatch(a, b)) {
        addGroup([a, b], ["fuzzyName", "sharedContact"]);
      }
    }
  }

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
                  {group.reasons.has("fuzzyName") ? (
                    <Badge variant="outline">{t("matchByFuzzyName")}</Badge>
                  ) : null}
                  {group.reasons.has("sharedContact") ? (
                    <Badge variant="outline">{t("matchBySharedContact")}</Badge>
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
