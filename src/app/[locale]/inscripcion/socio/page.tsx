import { LockIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getRegistrationAvailability } from "@/lib/registration-settings";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PublicHeader } from "@/components/public/public-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { SocioForm } from "./socio-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("memberCardTitle") };
}

export default async function InscripcionSocioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const [t, { memberOpen, seasonName, memberAnnualFeeCents }] = await Promise.all([
    getTranslations("Inscripciones"),
    getRegistrationAvailability(),
  ]);

  const feeAmount = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
    memberAnnualFeeCents / 100,
  );

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader variant="back" maxWidth="2xl" backHref="/inscripcion" backLabel={t("backToLanding")} />

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {memberOpen ? (
          <>
            <PageHeader
              className="mb-8"
              title={t("memberCardTitle")}
              description={t("memberFormSubtitle", { amount: feeAmount })}
              badges={
                seasonName ? (
                  <Badge variant="secondary">{t("seasonBadge", { season: seasonName })}</Badge>
                ) : null
              }
            />
            <SocioForm />
          </>
        ) : (
          <SectionPlaceholder
            icon={LockIcon}
            title={t("registrationClosedTitle")}
            description={t("registrationClosedDescription")}
          />
        )}
      </div>
    </div>
  );
}
