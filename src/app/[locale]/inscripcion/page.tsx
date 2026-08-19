import { ArrowLeftIcon, ArrowRightIcon, HeartHandshakeIcon, UserRoundIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getClubSettings } from "@/lib/club";
import { getRegistrationAvailability } from "@/lib/registration-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Inscripciones" });
  return { title: t("landingTitle") };
}

export default async function InscripcionLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);

  const [t, club, { teamRegistrationOpen, memberOpen }] = await Promise.all([
    getTranslations("Inscripciones"),
    getClubSettings(),
    getRegistrationAvailability(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {t("backHome")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-6 py-16 text-center md:py-20">
        {club?.legalName ? (
          <p className="text-sm font-medium text-muted-foreground">{club.legalName}</p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {t("landingTitle")}
        </h1>
        <p className="max-w-xl text-muted-foreground">{t("landingSubtitle")}</p>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-4 px-6 pb-24 sm:grid-cols-2">
        <Link
          href="/inscripcion/jugador"
          className="group flex flex-col gap-3 rounded-lg border p-6 transition-colors hover:bg-muted/40"
        >
          <UserRoundIcon className="size-6 text-muted-foreground" />
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              {t("playerCardTitle")}
              {teamRegistrationOpen ? null : <Badge variant="secondary">{t("closedBadge")}</Badge>}
            </h2>
            <p className="text-sm text-muted-foreground">{t("playerCardDescription")}</p>
          </div>
          <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
            {t("startAction")}
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          href="/inscripcion/socio"
          className="group flex flex-col gap-3 rounded-lg border p-6 transition-colors hover:bg-muted/40"
        >
          <HeartHandshakeIcon className="size-6 text-muted-foreground" />
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              {t("memberCardTitle")}
              {memberOpen ? null : <Badge variant="secondary">{t("closedBadge")}</Badge>}
            </h2>
            <p className="text-sm text-muted-foreground">{t("memberCardDescription")}</p>
          </div>
          <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
            {t("startAction")}
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>
    </div>
  );
}
