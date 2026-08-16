import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, Users, Wallet } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("home") };
}

export default async function Home() {
  const t = await getTranslations("Landing");

  const features = [
    { icon: Users, key: "people" },
    { icon: CalendarDays, key: "calendar" },
    { icon: Wallet, key: "fees" },
  ] as const;

  return (
    <div className="flex flex-1 flex-col">
      {/* Cabecera pública */}
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="font-semibold">{t("brand")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Button
              render={<Link href="/dashboard" />}
              nativeButton={false}
              size="sm"
            >
              {t("enter")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-20 md:py-28">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {t("heroDescription")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            render={<Link href="/dashboard" />}
            nativeButton={false}
            size="lg"
          >
            {t("openPanel")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </section>

      {/* Características */}
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.key}>
            <CardHeader>
              <feature.icon className="size-6 text-muted-foreground" />
              <CardTitle className="mt-2">
                {t(`features.${feature.key}.title`)}
              </CardTitle>
              <CardDescription>
                {t(`features.${feature.key}.description`)}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("featureFooter")}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
