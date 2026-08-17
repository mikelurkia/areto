"use client";

import { RouteError } from "@/components/route-error";

/**
 * Red de seguridad del idioma: recoge lo que escapa a `(app)/error.tsx`, en
 * particular los fallos del propio `(app)/layout.tsx` (la sesión del sidebar).
 */
export default function LocaleError(props: React.ComponentProps<typeof RouteError>) {
  return <RouteError {...props} />;
}
