import { getTranslations, setRequestLocale } from "next-intl/server";

import { getClubSettings } from "@/lib/club";
import { resolveBackHref } from "@/lib/back-href";
import { LegalInfoPage } from "@/components/inscripciones/legal-info-page";

const DEFAULT_LEGAL_NAME = "Aloña Mendi Kirol Elkartea - sección de Fútbol Sala";
const DEFAULT_TAX_ID = "G20157434";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("privacyInfoPageTitle") };
}

export default async function InscripcionPrivacidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale } = await params;
  const { from } = await searchParams;
  const backHref = resolveBackHref(from, "/inscripcion/jugador");
  setRequestLocale(locale);
  const t = await getTranslations("Inscripciones");
  const settings = await getClubSettings();

  const legalName = settings?.legalName || DEFAULT_LEGAL_NAME;
  const taxId = settings?.taxId || DEFAULT_TAX_ID;
  const contactSentence = settings?.email
    ? t("privacyContactWithEmail", { email: settings.email })
    : t("privacyContactNoEmail");

  const body = [
    `${t("privacyInfoPageIntro", { legalName, taxId })} ${contactSentence}`,
    t("privacyInfoPagePurpose"),
    t("privacyInfoPageLegal"),
    t("privacyInfoPageRecipients"),
    t("privacyInfoPageRetention"),
    t("privacyInfoPageRights"),
  ].join("\n\n");

  return <LegalInfoPage title={t("privacyInfoPageTitle")} body={body} backHref={backHref} />;
}
