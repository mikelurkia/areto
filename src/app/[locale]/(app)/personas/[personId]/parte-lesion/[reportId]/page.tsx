import { and, eq } from "drizzle-orm";
import { TriangleAlertIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { persons, memberships, personInjuryReports } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { InjuryReportForm } from "@/components/personas/injury-report-form";
import { InjuryReportFileManager } from "@/components/personas/injury-report-file-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
} from "@/lib/injury-report-pdf";
import { fileExists, getSignedUrl } from "@/lib/supabase/storage";

/** Igual que la constante homónima en `personas/actions.ts` y `personas/[personId]/page.tsx`. */
const INJURY_REPORTS_BUCKET = "person-injury-reports";

/** El segmento `[reportId]` vale esto cuando la página abre para dar de alta un parte nuevo. */
const NEW_REPORT_ID = "nuevo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // El idioma va explícito: un `getTranslations` a secas aquí lee cabeceras y,
  // con Cache Components, marcaría la ruta entera como bloqueante.
  const t = await getTranslations({ locale, namespace: "Personas" });
  return { title: t("injuryReportFederationTitle") };
}

export default async function InjuryReportFederationPage({
  params,
}: {
  params: Promise<{ locale: string; personId: string; reportId: string }>;
}) {
  const { locale, personId, reportId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("personas.medical.manage");
  const t = await getTranslations("Personas");

  const isNew = reportId === NEW_REPORT_ID;

  const person = await db.query.persons.findFirst({
    where: eq(persons.id, personId),
    columns: { firstName: true, lastName: true },
  });
  if (!person) notFound();

  // El parte tiene que ser de esta persona: si no, la URL está inventada y no
  // hay razón para enseñar el parte de otra bajo su ficha.
  const report = isNew
    ? null
    : ((await db.query.personInjuryReports.findFirst({
        where: and(
          eq(personInjuryReports.id, reportId),
          eq(personInjuryReports.personId, personId),
        ),
      })) ?? null);
  if (!isNew && !report) notFound();

  const [personMemberships, club, hasTemplate, fileUrl] = await Promise.all([
    db.query.memberships.findMany({
      where: eq(memberships.personId, personId),
      columns: {},
      with: {
        team: {
          columns: { id: true, name: true },
          with: { season: { columns: { name: true, isCurrent: true, startsOn: true } } },
        },
      },
    }),
    getClubSettings(),
    fileExists(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH),
    report ? getSignedUrl(INJURY_REPORTS_BUCKET, report.filePath) : Promise.resolve(null),
  ]);

  // Sin estos datos del club el impreso sale con la cabecera a medias, y la
  // Mutualidad devuelve los partes incompletos.
  const clubDataMissing = !club?.federationDelegation || !club?.signatoryName;

  // Equipos del jugador, el de la temporada en curso primero: es el que el
  // formulario deja ya elegido. Cuando hay fichas de varias temporadas se les
  // añade el nombre de la temporada, porque los equipos se llaman igual año
  // tras año ("Senior A") y si no, las opciones serían indistinguibles.
  const teams = [...personMemberships]
    .sort((a, b) => {
      if (a.team.season.isCurrent !== b.team.season.isCurrent) {
        return a.team.season.isCurrent ? -1 : 1;
      }
      return (b.team.season.startsOn ?? "").localeCompare(a.team.season.startsOn ?? "");
    })
    .map((m) => m.team);
  const severalSeasons = new Set(teams.map((team) => team.season.name)).size > 1;
  const teamOptions = teams.map((team) => ({
    id: team.id,
    name: severalSeasons ? `${team.name} · ${team.season.name}` : team.name,
  }));

  // El parte lo cubre la licencia federativa del jugador con su equipo: sin
  // ficha en ninguno no hay nada que tramitar, así que el formulario ni se
  // ofrece (el botón de alta tampoco aparece en la ficha de la persona). Un
  // parte ya existente sigue accesible para consultar o borrar su fichero.
  const noTeam = teamOptions.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        back={{
          href: `/personas/${personId}?tab=medico`,
          label: t("backToPersona"),
        }}
        title={isNew ? t("newInjuryReportTitle") : t("injuryReportFederationTitle")}
        description={`${person.firstName} ${person.lastName}${
          report ? ` · ${report.occurredOn}` : ""
        }`}
      />

      {hasTemplate && !clubDataMissing && !noTeam ? null : (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          {noTeam ? (
            <p className="flex items-start gap-2">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {t("injuryReportNoTeamWarning")}
            </p>
          ) : null}
          {!hasTemplate ? (
            <p className="flex items-start gap-2">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {t("injuryReportTemplateMissingWarning")}
            </p>
          ) : null}
          {clubDataMissing ? (
            <p className="flex items-start gap-2">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              {t("injuryReportClubDataMissingWarning")}
            </p>
          ) : null}
        </div>
      )}

      {isNew && noTeam ? null : (
        <div className="grid gap-4 lg:max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("injuryReportFederationSection")}</CardTitle>
              <CardDescription>{t("injuryReportFederationDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {noTeam ? null : (
                <InjuryReportForm
                  personId={personId}
                  report={
                    report && {
                      id: report.id,
                      notes: report.notes,
                      teamId: report.teamId,
                      reportedOn: report.reportedOn,
                      reportedPlace: report.reportedPlace,
                      place: report.place,
                      placeOther: report.placeOther,
                      matchMinute: report.matchMinute,
                      surface: report.surface,
                      collision: report.collision,
                      opponentTeam: report.opponentTeam,
                      relatedToPrevious: report.relatedToPrevious,
                      bootType: report.bootType,
                      trainingSurface: report.trainingSurface,
                      weeklyTrainingMinutes: report.weeklyTrainingMinutes,
                    }
                  }
                  teams={teamOptions}
                />
              )}
              {report ? (
                <InjuryReportFileManager reportId={report.id} fileUrl={fileUrl} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
