"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Cuerpo compartido por los `error.tsx`. Los textos llegan ya traducidos desde
 * fuera, en vez de resolver aquí un espacio de nombres variable, porque el
 * panel y las páginas públicas necesitan decir cosas distintas.
 *
 * `digest` es el identificador que Next deja en los logs del servidor: se
 * muestra para poder cruzar el aviso del usuario con la traza real.
 */
function ErrorCard({
  error,
  reset,
  title,
  description,
  retryLabel,
  backHref,
  backLabel,
  referenceLabel,
  detailsLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  description: string;
  retryLabel: string;
  backHref: string;
  backLabel: string;
  referenceLabel: string;
  detailsLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlertIcon className="size-5 text-destructive" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcwIcon data-icon="inline-start" />
          {retryLabel}
        </Button>
        <Button variant="outline" render={<Link href={backHref} />} nativeButton={false}>
          {backLabel}
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          {referenceLabel}: <code>{error.digest}</code>
        </p>
      ) : null}
      {process.env.NODE_ENV === "development" && error.message ? (
        <details className="max-w-xl text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {detailsLabel}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {error.message}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

/**
 * UI de los `error.tsx` del panel. Un fallo de consulta ya no tumba la pantalla
 * entera al error genérico de Next: se muestra aquí, con el sidebar y la
 * cabecera intactos, y `reset()` reintenta el render del segmento sin recargar
 * la página ni perder la sesión.
 */
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorBoundary");

  return (
    <ErrorCard
      error={error}
      reset={reset}
      title={t("title")}
      description={t("description")}
      retryLabel={t("retry")}
      backHref="/dashboard"
      backLabel={t("backToDashboard")}
      referenceLabel={t("referenceLabel")}
      detailsLabel={t("detailsLabel")}
    />
  );
}

/**
 * Versión para las páginas públicas. Quien se está inscribiendo no tiene
 * sesión, así que ni le sirve el botón "ir al panel" (que solo le rebotaría al
 * login) ni le dice nada un mensaje sobre la base de datos: aquí el texto habla
 * de reintentar y de avisar al club, que es lo único que puede hacer.
 */
export function PublicRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("PublicErrorBoundary");

  return (
    <ErrorCard
      error={error}
      reset={reset}
      title={t("title")}
      description={t("description")}
      retryLabel={t("retry")}
      backHref="/inscripcion"
      backLabel={t("back")}
      referenceLabel={t("referenceLabel")}
      detailsLabel={t("detailsLabel")}
    />
  );
}
