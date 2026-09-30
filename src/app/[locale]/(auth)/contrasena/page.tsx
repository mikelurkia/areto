import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthBrand } from "@/components/auth/auth-brand";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { CourtLines } from "@/components/public/court-lines";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("contrasena") };
}

/**
 * El titular cambia según de dónde venga el enlace (invitación o
 * recuperación), y el formulario necesita su token de un solo uso. Las dos
 * cosas viven en `searchParams`, que es dato de runtime: van en su propio
 * componente para que el resto de la página se prerenderice.
 */
async function PasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; token?: string }>;
}) {
  const { motivo, token } = await searchParams;
  const t = await getTranslations("Login");
  const isInvitation = motivo === "invitacion";

  return (
    <>
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">
          {isInvitation ? t("welcomeTitle") : t("resetTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isInvitation ? t("welcomeSubtitle") : t("resetSubtitle")}
        </p>
      </div>
      <SetPasswordForm token={token ?? ""} />
    </>
  );
}

export default async function ContrasenaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ motivo?: string; token?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <CourtLines />
      <ThemeToggle className="absolute top-6 right-6" />
      <div className="relative flex w-full max-w-sm flex-col gap-8">
        <AuthBrand />

        <Suspense
          fallback={
            <>
              <div className="flex flex-col items-center gap-2" aria-hidden>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex flex-col gap-4" aria-hidden>
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </>
          }
        >
          <PasswordContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
