import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClubSettingsForm } from "@/components/club/club-settings-form";
import { FederationAccountsList } from "@/components/club/federation-accounts-list";
import { InjuryReportTemplateForm } from "@/components/club/injury-report-template-form";
import { RegistrationAvailabilityForm } from "@/components/club/registration-availability-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import { getClubSettings, getFederationAccounts } from "@/lib/club";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
} from "@/lib/injury-report-pdf";
import { fileExists, getSignedUrl } from "@/lib/supabase/storage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("club") };
}

export default async function ClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("club.view");
  const t = await getTranslations("Club");
  const [clubSettings, federationAccounts, hasInjuryTemplate] = await Promise.all([
    getClubSettings(),
    getFederationAccounts(),
    fileExists(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH),
  ]);
  const injuryTemplateUrl = hasInjuryTemplate
    ? await getSignedUrl(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH)
    : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("clubSection")}</CardTitle>
            <CardDescription>{t("clubDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClubSettingsForm settings={clubSettings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("registrationSection")}</CardTitle>
            <CardDescription>{t("registrationDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationAvailabilityForm
              playerRegistrationOpen={clubSettings?.playerRegistrationOpen ?? false}
              memberRegistrationOpen={clubSettings?.memberRegistrationOpen ?? false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("injuryTemplateSection")}</CardTitle>
            <CardDescription>{t("injuryTemplateDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InjuryReportTemplateForm templateUrl={injuryTemplateUrl} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("federationsSection")}</CardTitle>
            <CardDescription>{t("federationsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FederationAccountsList accounts={federationAccounts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
