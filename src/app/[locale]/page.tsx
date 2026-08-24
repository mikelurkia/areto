import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRightIcon, HeartHandshake } from "lucide-react";

import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { CourtLines } from "@/components/public/court-lines";
import { FutsalBall } from "@/components/public/futsal-ball";
import { HeroCarousel } from "@/components/public/hero-carousel";
import { HeroCta } from "@/components/public/hero-cta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("home") };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Landing");

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader variant="brand" maxWidth="5xl" />

      {/*
        Hero: rellena lo que quede de pantalla entre cabecera y footer
        (flex-1), no un cálculo fijo que ignore la altura real del footer —
        así la home cabe en una pantalla sin scroll de sobra, y si el
        contenido no cupiera en una pantalla muy baja, crece con normalidad
        en vez de recortarse.
      */}
      <section className="relative flex flex-1 items-center overflow-hidden">
        <CourtLines />

        {/* Resplandores de fondo, en los colores del club */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 bottom-0 size-80 rounded-full bg-gold/20 blur-3xl"
        />

        {/* Balones flotando, guiño discreto al deporte */}
        <FutsalBall className="pointer-events-none absolute right-[14%] top-[18%] hidden size-12 animate-float text-primary/30 md:block" />
        <FutsalBall className="pointer-events-none absolute left-[8%] bottom-[12%] hidden size-8 animate-float text-gold/40 [animation-delay:1.4s] md:block" />

        <div className="relative mx-auto grid w-full max-w-[100rem] gap-10 px-6 py-16 sm:px-10 lg:px-16 xl:px-24 md:grid-cols-2 md:items-center md:py-28">
          <div className="flex flex-col items-start gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              {t("heroDescription")}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <HeroCta href="/inscripcion" tone="primary" icon={ArrowRightIcon}>
                {t("registerAction")}
              </HeroCta>
              <HeroCta href="/inscripcion/socio" tone="gold" icon={HeartHandshake}>
                {t("becomeMemberAction")}
              </HeroCta>
            </div>
          </div>
          <div className="flex justify-center animate-in fade-in zoom-in-95 duration-700 delay-150 fill-mode-both md:justify-end">
            <HeroCarousel />
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
