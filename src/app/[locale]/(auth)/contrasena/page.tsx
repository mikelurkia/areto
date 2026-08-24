import { Suspense } from "react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
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
 * recuperación), y eso vive en `searchParams`, que es dato de runtime: va en su
 * propio componente para que el resto de la página se prerenderice.
 */
async function PasswordHeading({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const t = await getTranslations("Login");
  const isInvitation = motivo === "invitacion";

  return (
    <div className="flex flex-col gap-1 text-center">
      <h1 className="text-xl font-semibold">
        {isInvitation ? t("welcomeTitle") : t("resetTitle")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {isInvitation ? t("welcomeSubtitle") : t("resetSubtitle")}
      </p>
    </div>
  );
}

export default async function ContrasenaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  // Se llega aquí con sesión: `/auth/confirm` la ha abierto al canjear el token
  // del correo. Sin ella no hay contraseña que cambiar.
  await requireUser();

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

        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-2" aria-hidden>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          }
        >
          <PasswordHeading searchParams={searchParams} />
        </Suspense>

        <SetPasswordForm />
      </div>
    </div>
  );
}
