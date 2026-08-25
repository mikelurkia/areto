import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthBrand } from "@/components/auth/auth-brand";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { CourtLines } from "@/components/public/court-lines";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("login") };
}

/**
 * El formulario necesita el `?next=` al que volver tras identificarse, y leer
 * `searchParams` es dato de runtime: va en su propio componente para que la
 * marca y los titulares de la página sí se prerenderizen.
 */
async function LoginFormWithRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Solo rutas internas: un `next` absoluto sería un open redirect.
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";
  return <LoginForm next={safeNext} />;
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="mx-auto h-3 w-28" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <CourtLines />
      <ThemeToggle className="absolute top-6 right-6" />
      <div className="relative flex w-full max-w-sm flex-col gap-8">
        <AuthBrand asHeading />

        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginFormWithRedirect searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
