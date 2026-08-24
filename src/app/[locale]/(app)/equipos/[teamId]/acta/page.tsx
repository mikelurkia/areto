import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { memberships, teams } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/print-button";
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
const getTeam = cache((teamId: string) =>
  db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { season: true },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  const [team, t] = await Promise.all([
    getTeam(teamId),
    getTranslations({ locale, namespace: "Equipos" }),
  ]);
  return { title: team ? `${t("rosterSheetTitle")} · ${team.name}` : "Areto" };
}

export default async function TeamRosterSheetPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("equipos.acta");
  const t = await getTranslations("Equipos");

  const [team, teamMemberships, club] = await Promise.all([
    getTeam(teamId),
    db.query.memberships.findMany({
      where: eq(memberships.teamId, teamId),
      with: { person: true },
      orderBy: (memberships, { asc }) => [asc(memberships.jerseyNumber)],
    }),
    getClubSettings(),
  ]);
  if (!team) notFound();

  // Jugadores primero (por dorsal), luego cuerpo técnico.
  const players = teamMemberships.filter((m) => m.role === "player");
  const staff = teamMemberships.filter((m) => m.role !== "player");
  const ordered = [...players, ...staff];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/equipos/${team.id}`} />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToTeam")}
        </Button>
        <PrintButton label={t("printAction")} />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-lg border p-8">
        {/* Cabecera: club + equipo + datos federativos */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("rosterSheetTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{club?.legalName ?? "Areto"}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{team.name}</p>
            <p className="text-muted-foreground">
              {team.category ? t(`category.${team.category}`) : t("categoryNone")}
              {team.gender ? ` · ${t(`gender.${team.gender}`)}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{team.season.name}</p>
            {team.federationGroup ? (
              <p className="mt-1 text-xs text-muted-foreground">{team.federationGroup}</p>
            ) : null}
            {team.federationCode ? (
              <p className="text-xs text-muted-foreground">
                {t("federationCodeShort", { code: team.federationCode })}
              </p>
            ) : null}
          </div>
        </div>

        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyRosterDescription")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{t("colJersey")}</TableHead>
                <TableHead>{t("rosterSheetColName")}</TableHead>
                <TableHead>{t("rosterSheetColNationalId")}</TableHead>
                <TableHead>{t("rosterSheetColBirthDate")}</TableHead>
                <TableHead>{t("roleLabel")}</TableHead>
                <TableHead>{t("rosterSheetColMedical")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">
                    {m.role === "player" ? (m.jerseyNumber ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {m.person.lastName}, {m.person.firstName}
                    {m.isCaptain ? ` (${t("captainShort")})` : ""}
                    {m.positions.includes("portero") ? ` (${t("isGoalkeeperLabel")})` : ""}
                  </TableCell>
                  <TableCell>{m.person.nationalId ?? "—"}</TableCell>
                  <TableCell>{m.person.birthDate ?? "—"}</TableCell>
                  <TableCell>
                    {t(`roleOption.${m.role}`)}
                    {m.position ? ` · ${m.position}` : ""}
                  </TableCell>
                  <TableCell>{m.person.medicalCertUntil ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Firmas */}
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div className="border-t pt-2 text-muted-foreground">
            {t("rosterSheetSignCoach")}
          </div>
          <div className="border-t pt-2 text-muted-foreground">
            {t("rosterSheetSignClub")}
          </div>
        </div>
      </div>
    </div>
  );
}
