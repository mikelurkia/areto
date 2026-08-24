import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const handleI18nRouting = createMiddleware(routing);

/**
 * Rutas accesibles SIN sesión (sin el prefijo de idioma). Todo lo demás la
 * exige.
 *
 * La lista está invertida a propósito. Antes se enumeraban las rutas
 * protegidas, y se quedó corta más de una vez: `/socios`, `/inscripciones` y
 * `/medico` llevaban tiempo fuera y dependían solo de la comprobación de su
 * página. Con una lista blanca de lo público —que es cerrada y cambia poco—,
 * cualquier ruta nueva del grupo `(app)` nace protegida.
 *
 * Este corte es la primera barrera para las peticiones anónimas: el layout ya
 * no bloquea el render con la comprobación de sesión (la resuelve dentro de un
 * <Suspense>). No comprueba permisos: eso exigiría una consulta a Postgres en
 * cada petición, y el JWT no lleva ni rol ni estado.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/inscripcion",
  "/patrocinadores-muro",
  "/auth-code-error",
  "/acceso-revocado",
  "/acceso-no-autorizado",
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
  if (pathname === "/") return false;
  return !PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Enruta el idioma (next-intl) y, sobre esa misma respuesta, refresca la
 * sesión de Supabase en cada request y protege las rutas internas.
 * IMPORTANTE: no metas código entre `createServerClient` y `getClaims()`.
 * Las cookies de sesión se escriben sobre la respuesta ya generada por
 * next-intl para no perder la resolución de idioma.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (response.status >= 300 && response.status < 400) return response;
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

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
