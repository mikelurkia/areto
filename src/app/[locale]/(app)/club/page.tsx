import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClubSettingsForm } from "@/components/club/club-settings-form";
import { FederationAccountsList } from "@/components/club/federation-accounts-list";
import { InjuryReportTemplateForm } from "@/components/club/injury-report-template-form";
import { RegistrationAvailabilityForm } from "@/components/club/registration-availability-form";
import { InfoRow } from "@/components/info-row";
import { MaskedIbanText } from "@/components/masked-iban";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getClubSettings, getFederationAccounts } from "@/lib/club";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
} from "@/lib/injury-report-pdf";
import { formatCents } from "@/lib/money";
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
  const user = await requirePermission("club.view");
  const canManage = hasPermission(user, "club.manage");
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
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("clubSection")}</CardTitle>
            <CardDescription>{t("clubDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <ClubSettingsForm settings={clubSettings} />
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label={t("clubLegalNameLabel")} value={clubSettings?.legalName} />
                <InfoRow label={t("clubTaxIdLabel")} value={clubSettings?.taxId} />
                <InfoRow
                  label={t("clubIbanLabel")}
                  value={clubSettings?.iban ? <MaskedIbanText value={clubSettings.iban} /> : null}
                />
                <InfoRow label={t("clubAddressLabel")} value={clubSettings?.address} />
                <InfoRow label={t("clubEmailLabel")} value={clubSettings?.email} />
                <InfoRow label={t("clubPhoneLabel")} value={clubSettings?.phone} />
                <InfoRow
                  label={t("clubFederationCodeLabel")}
                  value={clubSettings?.federationCode}
                />
                <InfoRow
                  label={t("clubFederationDelegationLabel")}
                  value={clubSettings?.federationDelegation}
                />
                <InfoRow
                  label={t("clubSignatoryNameLabel")}
                  value={clubSettings?.signatoryName}
                />
                <InfoRow
                  label={t("clubSignatoryNationalIdLabel")}
                  value={clubSettings?.signatoryNationalId}
                />
                <InfoRow
                  label={t("clubMemberAnnualFeeLabel")}
                  value={formatCents(clubSettings?.memberAnnualFeeCents ?? 2000, locale)}
                />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("registrationSection")}</CardTitle>
            <CardDescription>{t("registrationDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <RegistrationAvailabilityForm
                playerRegistrationOpen={clubSettings?.playerRegistrationOpen ?? false}
                memberRegistrationOpen={clubSettings?.memberRegistrationOpen ?? false}
              />
            ) : (
              <dl className="flex flex-col gap-3">
                <InfoRow
                  label={t("playerRegistrationOpenLabel")}
                  value={
                    <Badge variant={clubSettings?.playerRegistrationOpen ? "secondary" : "outline"}>
                      {clubSettings?.playerRegistrationOpen
                        ? t("registrationOpenBadge")
                        : t("registrationClosedBadge")}
                    </Badge>
                  }
                />
                <InfoRow
                  label={t("memberRegistrationOpenLabel")}
                  value={
                    <Badge variant={clubSettings?.memberRegistrationOpen ? "secondary" : "outline"}>
                      {clubSettings?.memberRegistrationOpen
                        ? t("registrationOpenBadge")
                        : t("registrationClosedBadge")}
                    </Badge>
                  }
                />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("injuryTemplateSection")}</CardTitle>
            <CardDescription>{t("injuryTemplateDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InjuryReportTemplateForm templateUrl={injuryTemplateUrl} canManage={canManage} />
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
