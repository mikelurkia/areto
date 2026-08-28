import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClubFederationForm } from "@/components/club/club-federation-form";
import { ClubIdentityForm } from "@/components/club/club-identity-form";
import { ClubImageUploadForm } from "@/components/club/club-image-upload-form";
import { ClubMedicalForm } from "@/components/club/club-medical-form";
import { ClubSignatoriesForm } from "@/components/club/club-signatories-form";
import { ClubTabs } from "@/components/club/club-tabs";
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
import { getClubBrandingAssets, getClubSettings, getFederationAccounts } from "@/lib/club";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
} from "@/lib/injury-report-pdf";
import { formatCents } from "@/lib/money";
import { fileExists, getSignedUrl } from "@/lib/supabase/storage";
import { uploadClubLogo, uploadClubSeal, uploadClubSignature } from "./actions";

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
  // Aparte del `Promise.all` de arriba: por debajo dispara varias queries de
  // Storage propias, y sumarlas a las de la página ha colgado el pooler
  // transaccional de Supabase alguna vez (ver CLAUDE.md).
  const branding = await getClubBrandingAssets();

  const datosTab = (
    <Card>
      <CardHeader>
        <CardTitle>{t("clubSection")}</CardTitle>
        <CardDescription>{t("clubDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {canManage ? (
          <ClubIdentityForm settings={clubSettings} />
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
          </dl>
        )}
        {canManage ? (
          <ClubImageUploadForm
            action={uploadClubLogo}
            fieldName="logo"
            imageUrl={branding.logoUrl}
            label={t("clubLogoLabel")}
          />
        ) : (
          <InfoRow
            label={t("clubLogoLabel")}
            value={
              branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-12 w-auto object-contain" />
              ) : null
            }
          />
        )}
      </CardContent>
    </Card>
  );

  const firmantesTab = (
    <Card>
      <CardHeader>
        <CardTitle>{t("signatoriesSection")}</CardTitle>
        <CardDescription>{t("signatoriesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {canManage ? (
          <ClubSignatoriesForm settings={clubSettings} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoRow
              label={t("clubSignatoryNameLabel")}
              value={clubSettings?.signatoryName}
            />
            <InfoRow
              label={t("clubSignatoryNationalIdLabel")}
              value={clubSettings?.signatoryNationalId}
            />
          </dl>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {canManage ? (
            <ClubImageUploadForm
              action={uploadClubSeal}
              fieldName="seal"
              imageUrl={branding.sealUrl}
              label={t("clubSealLabel")}
            />
          ) : (
            <InfoRow
              label={t("clubSealLabel")}
              value={
                branding.sealUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.sealUrl} alt="" className="h-16 w-auto object-contain" />
                ) : null
              }
            />
          )}
          {canManage ? (
            <ClubImageUploadForm
              action={uploadClubSignature}
              fieldName="signature"
              imageUrl={branding.signatureUrl}
              label={t("clubSignatureLabel")}
            />
          ) : (
            <InfoRow
              label={t("clubSignatureLabel")}
              value={
                branding.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.signatureUrl}
                    alt=""
                    className="h-16 w-auto object-contain"
                  />
                ) : null
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  const inscripcionesTab = (
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
            memberAnnualFeeCents={clubSettings?.memberAnnualFeeCents ?? 2000}
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
            <InfoRow
              label={t("clubMemberAnnualFeeLabel")}
              value={formatCents(clubSettings?.memberAnnualFeeCents ?? 2000, locale)}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );

  const medicoTab = (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("medicalSettingsSection")}</CardTitle>
          <CardDescription>{t("medicalSettingsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ClubMedicalForm federationDelegation={clubSettings?.federationDelegation ?? null} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow
                label={t("clubFederationDelegationLabel")}
                value={clubSettings?.federationDelegation}
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
    </div>
  );

  const federacionesTab = (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("federationCodeSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ClubFederationForm federationCode={clubSettings?.federationCode ?? null} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow
                label={t("clubFederationCodeLabel")}
                value={clubSettings?.federationCode}
              />
            </dl>
          )}
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
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="lg:max-w-2xl">
        <ClubTabs
          datos={datosTab}
          firmantes={firmantesTab}
          inscripciones={inscripcionesTab}
          medico={medicoTab}
          federaciones={federacionesTab}
        />
      </div>
    </div>
  );
}
