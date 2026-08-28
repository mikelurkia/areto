"use client";

import { useState, type ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type LinkProps = ComponentProps<typeof Link>;

/**
 * `Link` que no precarga al entrar en el viewport, sino cuando el usuario
 * apunta al enlace (ratón, foco de teclado o toque).
 *
 * Con Cache Components el prefetch va por segmento y cada destino cuesta
 * varias peticiones RSC. En pantallas con muchos enlaces visibles a la vez
 * —el menú lateral (12 secciones) o un listado paginado (25 filas)— el
 * comportamiento por defecto dispara cientos de peticiones al montar, todas
 * en paralelo: el `receive` de las respuestas con parte dinámica se queda
 * abierto decenas de segundos porque cada una pide su conexión al pooler, y
 * el pool (10 conexiones) no da para tantas. Medido en un HAR de `/personas`:
 * 511 peticiones en 25 s, 47 de ellas colgadas ~29 s.
 *
 * `prefetch={false}` desactiva la precarga también en hover; el patrón para
 * conservarla es volver a `null` (el valor por defecto) en cuanto hay
 * intención de navegar, que es lo que hace este componente.
 * Ver `node_modules/next/dist/docs/01-app/02-guides/prefetching.md`.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<LinkProps, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
