"use client";

import { RouteError } from "@/components/route-error";

/**
 * Límite de error de todo el panel: cubre las páginas del grupo `(app)` y sus
 * segmentos anidados que no declaren el suyo. No cubre el `layout.tsx` de este
 * mismo segmento; de eso se encarga `[locale]/error.tsx`.
 */
export default function AppError(props: React.ComponentProps<typeof RouteError>) {
  return <RouteError {...props} />;
}
