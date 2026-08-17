"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * UI compartida por los `error.tsx` del panel. Un fallo de consulta ya no tumba
 * la pantalla entera al error genérico de Next: se muestra aquí, con el sidebar
 * y la cabecera intactos, y `reset()` reintenta el render del segmento sin
 * recargar la página ni perder la sesión.
 *
 * `digest` es el identificador que Next deja en los logs del servidor: se
 * muestra para poder cruzar el aviso del usuario con la traza real.
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlertIcon className="size-5 text-destructive" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcwIcon data-icon="inline-start" />
          {t("retry")}
        </Button>
        <Button variant="outline" render={<Link href="/dashboard" />} nativeButton={false}>
          {t("backToDashboard")}
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          {t("referenceLabel")}: <code>{error.digest}</code>
        </p>
      ) : null}
      {process.env.NODE_ENV === "development" && error.message ? (
        <details className="max-w-xl text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t("detailsLabel")}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {error.message}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
