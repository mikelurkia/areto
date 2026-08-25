"use client";

import { PublicRouteError } from "@/components/route-error";

/**
 * Límite de error del formulario público de inscripción. Sin esto lo recogía
 * `[locale]/error.tsx`, que está escrito para el panel: hablaba de la base de
 * datos (aunque el fallo fuese otro, p. ej. una petición demasiado grande) y
 * ofrecía "ir al panel" a quien no tiene sesión.
 */
export default function InscripcionError(
  props: React.ComponentProps<typeof PublicRouteError>,
) {
  return <PublicRouteError {...props} />;
}
