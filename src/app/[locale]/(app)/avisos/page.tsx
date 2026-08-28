import { Megaphone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("avisos") };
}

export default async function AvisosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const t = await getTranslations("Avisos");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SectionPlaceholder
        icon={Megaphone}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        actionLabel={t("action")}
      />
    </div>
  );
}
