import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalInfoPage } from "@/components/inscripciones/legal-info-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("conditionsInfoPageTitle") };
}

export default async function InscripcionJugadorCondicionesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Inscripciones");
  const body = [t("travelSectionBody"), t("kitSectionBody")].join("\n\n");

  return <LegalInfoPage title={t("conditionsInfoPageTitle")} body={body} />;
}
