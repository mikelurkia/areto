import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

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
  const t = await getTranslations("Login");

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Link href="/" className="flex items-center gap-2 self-center">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            A
          </div>
          <span className="text-lg font-semibold">Areto</span>
        </Link>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginFormWithRedirect searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
