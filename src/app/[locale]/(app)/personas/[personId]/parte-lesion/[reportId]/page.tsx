import { and, eq } from "drizzle-orm";
import { DownloadIcon, TriangleAlertIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { memberships, personInjuryReports } from "@/db/schema";
import { BackLink } from "@/components/back-link";
import { InjuryReportFederationForm } from "@/components/personas/injury-report-federation-form";
import { Button } from "@/components/ui/button";
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
import { fileExists } from "@/lib/supabase/storage";

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

  // El parte tiene que ser de esta persona: si no, la URL está inventada y no
  // hay razón para enseñar el parte de otra bajo su ficha.
  const report = await db.query.personInjuryReports.findFirst({
    where: and(
      eq(personInjuryReports.id, reportId),
      eq(personInjuryReports.personId, personId),
    ),
    with: { person: { columns: { firstName: true, lastName: true } } },
  });
  if (!report) notFound();

  const [personTeams, club, hasTemplate] = await Promise.all([
    db.query.memberships.findMany({
      where: eq(memberships.personId, personId),
      columns: {},
      with: { team: { columns: { id: true, name: true } } },
    }),
    getClubSettings(),
    fileExists(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH),
  ]);

  // Sin estos datos del club el impreso sale con la cabecera a medias, y la
  // Mutualidad devuelve los partes incompletos.
  const clubDataMissing = !club?.federationDelegation || !club?.signatoryName;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLink href={`/personas/${personId}?tab=medico`} label={t("backToPersona")} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("injuryReportFederationTitle")}
        </h1>
        <p className="text-muted-foreground">
          {report.person.firstName} {report.person.lastName} · {report.occurredOn}
        </p>
      </div>

      {hasTemplate && !clubDataMissing ? null : (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
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

      <div className="grid gap-4 lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("injuryReportFederationSection")}</CardTitle>
            <CardDescription>{t("injuryReportFederationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <InjuryReportFederationForm
              report={{
                id: report.id,
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
              }}
              teams={personTeams.map((m) => m.team)}
            />
            {/* Enlace normal y no una Server Action: la respuesta es un PDF que
                el navegador tiene que descargar (ver el route handler). */}
            <Button
              variant="outline"
              className="self-start"
              disabled={!hasTemplate}
              render={<a href={`/api/partes-lesion/${report.id}`} />}
              nativeButton={false}
            >
              <DownloadIcon data-icon="inline-start" />
              {t("injuryReportDownloadAction")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
