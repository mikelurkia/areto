"use client";

import "./globals.css";

/**
 * Último recurso: el único límite de error que cubre el layout raíz.
 *
 * El layout de verdad es `[locale]/layout.tsx` —monta `<html>`, las fuentes,
 * el tema y `NextIntlClientProvider`—, y un `error.tsx` no cubre nunca el
 * layout que lo contiene. Si falla ese montaje, `[locale]/error.tsx` no llega
 * a pintarse y hasta ahora quedaba el error genérico de Next.
 *
 * Por eso aquí no se usa nada del proyecto: ni `useTranslations` (no hay
 * proveedor), ni ningún `Link` (necesita el enrutado), ni las
 * variables de fuente (las define el layout que ha fallado). Solo los tokens
 * de color de `globals.css` y un enlace normal.
 *
 * El texto va en los dos idiomas porque en este punto no se sabe cuál pedía
 * la petición: `<html lang>` es obligatorio y no hay locale que poner.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground antialiased">
        <h1 className="text-lg font-medium">Algo ha fallado / Zerbaitek huts egin du</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No se ha podido cargar la aplicación. Vuelve a intentarlo; si sigue
          igual, avisa al club.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reintentar / Berriro saiatu
          </button>
          {/* Recarga completa, no navegación de cliente: si lo que ha
              fallado es el montaje del layout raíz, volver a entrar de cero
              es justo lo que hace falta. */}
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Inicio / Hasiera
          </button>
        </div>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">
            Referencia: <code>{error.digest}</code>
          </p>
        ) : null}
      </body>
    </html>
  );
}
