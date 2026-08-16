import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  // Redirección/rewrite de idioma ya decidida por next-intl (p.ej. 307 a "/es").
  // La sesión se comprueba en la siguiente petición, ya con el idioma en la URL.
  if (response.status >= 300 && response.status < 400) return response;

  return updateSession(request, response);
}

export const config = {
  matcher: [
    /*
     * Coincide con todo salvo:
     * - _next/static, _next/image
     * - favicon y archivos estáticos comunes
     * - /auth/callback: destino fijo del redirect OAuth/email de Supabase, sin prefijo de idioma
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
