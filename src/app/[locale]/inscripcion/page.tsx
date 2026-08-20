import { ArrowRightIcon, HeartHandshakeIcon, UserRoundIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
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
      <PublicHeader variant="back" maxWidth="3xl" backHref="/" backLabel={t("backHome")} />

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
          className="group flex flex-col gap-3 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRoundIcon className="size-5" />
          </div>
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
          className="group flex flex-col gap-3 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-gold/15 text-gold-foreground">
            <HeartHandshakeIcon className="size-5" />
          </div>
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

      <PublicFooter />
    </div>
  );
}
