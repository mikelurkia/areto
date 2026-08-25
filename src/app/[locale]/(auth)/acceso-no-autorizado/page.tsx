import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { AuthBrand } from "@/components/auth/auth-brand";
import { CourtLines } from "@/components/public/court-lines";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("accesoNoAutorizado") };
}

/**
 * Dónde aterriza quien intenta entrar con una cuenta (normalmente de Google) a
 * la que nadie ha invitado. La cuenta ya se ha eliminado al llegar aquí, así
 * que no hay sesión que cerrar: solo la vuelta al acceso.
 */
export default async function AccesoNoAutorizadoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const t = await getTranslations("AuthErrors");

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <CourtLines />
      <ThemeToggle className="absolute top-6 right-6" />
      <div className="relative flex w-full max-w-sm flex-col gap-8">
        <AuthBrand />

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{t("notInvitedTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("notInvitedDescription")}
          </p>
        </div>

        <Button variant="outline" render={<Link href="/login" />} nativeButton={false}>
          {t("backToLogin")}
        </Button>
      </div>
    </div>
  );
}
