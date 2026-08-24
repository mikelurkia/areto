import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, HeartHandshake, Users } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { CourtLines } from "@/components/public/court-lines";
import { HeroCarousel } from "@/components/public/hero-carousel";

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

  const features = [
    { icon: Users, key: "people" },
    { icon: CalendarDays, key: "calendar" },
    { icon: HeartHandshake, key: "fees" },
  ] as const;

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader variant="brand" maxWidth="5xl" />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <CourtLines />
        <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div className="flex flex-col items-start gap-6">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              {t("heroDescription")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                render={<Link href="/inscripcion" />}
                nativeButton={false}
                size="lg"
                className="shadow-sm shadow-primary/30"
              >
                {t("registerAction")}
              </Button>
              <Button
                render={<Link href="/inscripcion/socio" />}
                nativeButton={false}
                size="lg"
                className="bg-gold text-gold-foreground shadow-sm shadow-gold/30 hover:bg-gold/80"
              >
                {t("becomeMemberAction")}
              </Button>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <HeroCarousel />
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 md:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.key}
            className="transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <feature.icon className="size-5 text-primary" strokeWidth={1.75} />
                {t(`features.${feature.key}.title`)}
              </CardTitle>
              <CardDescription>
                {t(`features.${feature.key}.description`)}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <PublicFooter />
    </div>
  );
}
