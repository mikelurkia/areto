import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { CourtLines } from "@/components/public/court-lines";
import { ThemeToggle } from "@/components/theme-toggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("accesoRevocado") };
}

/**
 * Dónde aterriza quien tiene una cuenta desactivada o todavía sin activar.
 *
 * Es pública (no está protegida en el proxy): quien llega aquí tiene sesión
 * pero no acceso, así que mandarlo al login solo produciría un bucle. Lleva
 * botón de cerrar sesión para que no sea un callejón sin salida.
 */
export default async function AccesoRevocadoPage({
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
        <Link href="/" className="flex items-center gap-2 self-center">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 object-contain"
          />
          <span className="font-heading text-lg font-semibold">Areto</span>
        </Link>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{t("accessRevokedTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("accessRevokedDescription")}
          </p>
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}
