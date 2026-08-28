import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageHeader } from "@/components/page-header";
import {
  DangerZone,
  EmailForm,
  PasswordForm,
  ProfileForm,
} from "@/components/settings/settings-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("ajustes") };
}

export default async function AjustesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Settings");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("profileSection")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ProfileForm fullName={user.fullName} />
            <EmailForm email={user.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("passwordSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("languageSection")}</CardTitle>
            <CardDescription>{t("languageDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LocaleSwitcher persist />
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("dangerSection")}
            </CardTitle>
            <CardDescription>{t("dangerDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DangerZone email={user.email} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
