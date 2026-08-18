import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalInfoPage } from "@/components/inscripciones/legal-info-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("imageInfoPageTitle") };
}

export default async function InscripcionJugadorImagenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Inscripciones");

  return <LegalInfoPage title={t("imageInfoPageTitle")} body={t("imageInfoPageBody")} />;
}
