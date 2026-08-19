import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getRegistrationAvailability } from "@/lib/registration-settings";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
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
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6">
          <Link
            href="/inscripcion"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {t("backToLanding")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {memberOpen ? (
          <>
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{t("memberCardTitle")}</h1>
                {seasonName ? <Badge variant="secondary">{t("seasonBadge", { season: seasonName })}</Badge> : null}
              </div>
              <p className="text-muted-foreground">
                {t("memberFormSubtitle", { amount: feeAmount })}
              </p>
            </div>
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
