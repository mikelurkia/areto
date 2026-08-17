import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * Rutas internas que requieren sesión iniciada (sin el prefijo de idioma).
 * Debe cubrir todo el grupo `(app)`: el layout ya no bloquea el render con la
 * comprobación de sesión (la resuelve dentro de un <Suspense>), así que este
 * corte es la primera barrera para las peticiones anónimas.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/personas",
  "/equipos",
  "/temporadas",
  "/calendario",
  "/patrocinadores",
  "/cuotas",
  "/avisos",
  "/club",
  "/ajustes",
];

const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/** Separa el prefijo de idioma del resto de la ruta, p.ej. "/es/dashboard" -> { locale: "es", rest: "/dashboard" }. */
function splitLocale(pathname: string) {
  const match = pathname.match(localePattern);
  const locale = match?.[1] ?? routing.defaultLocale;
  const rest = match ? pathname.slice(match[0].length) || "/" : pathname;
  return { locale, rest };
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refresca la sesión en cada petición y protege las rutas internas.
 * IMPORTANTE: no metas código entre `createServerClient` y `getClaims()`.
 * `response` es la respuesta ya generada por el middleware de next-intl: las
 * cookies de sesión se escriben sobre ella para no perder la resolución de idioma.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  // Sin Supabase configurado no bloqueamos nada (la app sigue usable).
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { locale, rest: pathname } = splitLocale(request.nextUrl.pathname);

  // Sin sesión en una ruta protegida → al login (recordando el destino).
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión, si va al login → directo al panel.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
