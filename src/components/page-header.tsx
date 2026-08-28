import type * as React from "react";

import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

/*
 * Cabecera de página y encabezado de sección.
 *
 * Los dos bloques estaban copiados a mano en una treintena de páginas —con la
 * divergencia previsible: `text-xl` en unas, `text-2xl` en otras, subtítulo con
 * `text-sm` en la ficha de patrocinador y sin él en el resto—. Aquí viven una
 * sola vez, con la geometría que `PageHeaderSkeleton` y `DetailHeaderSkeleton`
 * ya imitaban (ver `skeletons.tsx`): si cambia una, cambia la otra.
 *
 * Los textos entran **ya traducidos**. Es lo que permite usarlos igual desde
 * una página servidor (`getTranslations`) que desde un componente cliente
 * (`useTranslations`), y lo que evita meter una dependencia asíncrona en la
 * cabecera, que es justo lo que un fallback de Suspense no puede esperar.
 */

export type PageHeaderProps = {
  /** Ya traducido. */
  title: string;
  /** Los listados lo llevan; las fichas, casi nunca. */
  description?: React.ReactNode;
  /** Enlace "volver a…", sobre el título. No se imprime. */
  back?: { href: string; label: string };
  /** Etiquetas en línea con el título (temporada actual, estado de la ficha). */
  badges?: React.ReactNode;
  /**
   * Fila bajo el título: etiquetas de estado y fecha de envío. Va aparte de
   * `badges` porque en las fichas son demasiadas para caber junto al nombre.
   */
  meta?: React.ReactNode;
  /** Logo o avatar a la izquierda del bloque de texto; lo dimensiona quien lo pasa. */
  media?: React.ReactNode;
  /** Botones y diálogos, a la derecha. No se imprimen. */
  actions?: React.ReactNode;
  /** `compact` baja el título a `text-xl`: sub-páginas y cabeceras de ficha. */
  size?: "default" | "compact";
  as?: "h1" | "h2";
  className?: string;
};

export function PageHeader({
  title,
  description,
  back,
  badges,
  meta,
  media,
  actions,
  size = "default",
  as: Heading = "h1",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Sin envoltorio: al imprimirse desaparece del flujo y no deja el hueco
          del `gap` que sí dejaría un contenedor vacío. `w-fit` porque, como
          hijo de una columna flex, si no se estiraría a todo lo ancho. */}
      {back ? (
        <BackLink href={back.href} label={back.label} className="w-fit" />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {media ? <div className="shrink-0">{media}</div> : null}
          {/* `min-w-0` para que un nombre largo se recorte en vez de empujar
              las acciones fuera de la fila. */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Heading
                className={cn(
                  "truncate font-semibold tracking-tight",
                  size === "compact" ? "text-xl" : "text-2xl"
                )}
              >
                {title}
              </Heading>
              {badges}
            </div>
            {description ? (
              <p className="text-muted-foreground">{description}</p>
            ) : null}
            {meta ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type SectionHeadingProps = {
  /** Ya traducido. */
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
};

/** Rótulo de sección dentro de una página: versalitas pequeñas y apagadas. */
export function SectionHeading({
  title,
  description,
  actions,
  as: Heading = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        className
      )}
    >
      <div className="min-w-0">
        <Heading className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </Heading>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 print:hidden">{actions}</div>
      ) : null}
    </div>
  );
}
