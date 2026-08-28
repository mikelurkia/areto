import { cache } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { memberships, teams } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { PrintableSheet } from "@/components/printable-sheet";
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
        <BackLink href={`/equipos/${team.id}`} label={t("backToTeam")} />
        <PrintButton label={t("printAction")} />
      </div>

      <PrintableSheet>
        {/* Cabecera: club + equipo + datos federativos */}
        <div className="flex items-start justify-between border-b pb-[9pt]">
          <div>
            <h1 className="text-[11pt] font-semibold tracking-tight">
              {t("rosterSheetTitle")}
            </h1>
            <p className="text-[8pt] text-muted-foreground">{club?.legalName ?? "Areto"}</p>
          </div>
          <div className="text-right text-[8pt]">
            <p className="font-medium">{team.name}</p>
            <p className="text-muted-foreground">
              {team.category ? t(`category.${team.category}`) : t("categoryNone")}
              {team.gender ? ` · ${t(`gender.${team.gender}`)}` : ""}
            </p>
            <p className="text-[7pt] text-muted-foreground">{team.season.name}</p>
            {team.federationGroup ? (
              <p className="mt-1 text-[7pt] text-muted-foreground">{team.federationGroup}</p>
            ) : null}
            {team.federationCode ? (
              <p className="text-[7pt] text-muted-foreground">
                {t("federationCodeShort", { code: team.federationCode })}
              </p>
            ) : null}
          </div>
        </div>

        {ordered.length === 0 ? (
          <p className="text-[8pt] text-muted-foreground">{t("emptyRosterDescription")}</p>
        ) : (
          /* Tabla de documento, no de pantalla: `table-fixed` con anchos por
             columna (el reparto automático daría de sí la columna del nombre a
             costa de las demás) y sin el `whitespace-nowrap` que `ui/table.tsx`
             pone por defecto, que es justo lo que ensancha la tabla más allá de
             la hoja y saca el scroll horizontal. */
          <Table className="table-fixed text-[8pt] [&_td]:px-[3pt] [&_td]:py-[1.5pt] [&_th]:px-[3pt] [&_th]:py-[1.5pt] [&_td]:whitespace-normal [&_th]:break-words [&_th]:whitespace-normal">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8%]">{t("colJersey")}</TableHead>
                <TableHead className="w-[30%]">{t("rosterSheetColName")}</TableHead>
                <TableHead className="w-[13%]">{t("rosterSheetColNationalId")}</TableHead>
                <TableHead className="w-[12%]">{t("rosterSheetColBirthDate")}</TableHead>
                <TableHead className="w-[19%]">{t("roleLabel")}</TableHead>
                <TableHead className="w-[18%]">{t("rosterSheetColMedical")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="align-top tabular-nums">
                    {m.role === "player" ? (m.jerseyNumber ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="align-top font-medium">
                    {m.person.lastName}, {m.person.firstName}
                    {m.isCaptain ? ` (${t("captainShort")})` : ""}
                    {m.positions.includes("portero") ? ` (${t("isGoalkeeperLabel")})` : ""}
                  </TableCell>
                  <TableCell className="align-top">{m.person.nationalId ?? "—"}</TableCell>
                  <TableCell className="align-top">{m.person.birthDate ?? "—"}</TableCell>
                  <TableCell className="align-top">
                    {t(`roleOption.${m.role}`)}
                    {m.position ? ` · ${m.position}` : ""}
                  </TableCell>
                  <TableCell className="align-top">
                    {m.person.medicalCertUntil ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Firmas: `break-inside-avoid` para que un salto de página no las parta */}
        <div className="mt-[18pt] grid break-inside-avoid grid-cols-2 gap-[18pt] text-[8pt]">
          <div className="border-t pt-2 text-muted-foreground">
            {t("rosterSheetSignCoach")}
          </div>
          <div className="border-t pt-2 text-muted-foreground">
            {t("rosterSheetSignClub")}
          </div>
        </div>
      </PrintableSheet>
    </div>
  );
}
