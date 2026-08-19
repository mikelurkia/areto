import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalInfoPage } from "@/components/inscripciones/legal-info-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("sepaInfoPageTitle") };
}

export default async function InscripcionJugadorSepaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Inscripciones");

  return <LegalInfoPage title={t("sepaInfoPageTitle")} body={t("sepaInfoPageBody")} />;
}
