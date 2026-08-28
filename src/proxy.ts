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
 * Peticiones de precarga del router, no navegaciones de verdad.
 *
 * Con Cache Components el prefetch va por segmento, así que un solo repintado
 * del sidebar dispara del orden de 25 peticiones en paralelo (varias por
 * destino, con distinto `_rsc`). Todas pasan por aquí.
 */
function isPrefetch(request: NextRequest) {
  return (
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  );
}

/**
 * Cookie de sesión de Supabase (`sb-<ref>-auth-token`, troceada en `.0`, `.1`…
 * cuando no cabe). Solo mira que esté: no la valida ni la refresca.
 */
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));
}

/**
 * Enruta el idioma (next-intl) y, sobre esa misma respuesta, refresca la
 * sesión de Supabase en cada request y protege las rutas internas.
 * IMPORTANTE: no metas código entre `createServerClient` y `getClaims()`.
 * Las cookies de sesión se escriben sobre la respuesta ya generada por
 * next-intl para no perder la resolución de idioma.
 *
 * Los prefetch quedan fuera de ese refresco a propósito: ver `isPrefetch`.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (response.status >= 300 && response.status < 400) return response;
  if (!isSupabaseConfigured) return response;

  const { locale, rest: pathname } = splitLocale(request.nextUrl.pathname);

  /*
    Un prefetch no refresca la sesión. `getClaims()` renueva el token cuando
    está a punto de caducar y rota el refresh token; con las decenas de
    prefetch simultáneos que dispara el sidebar, esa rotación se intenta
    muchas veces a la vez y unas peticiones acaban viendo sesión y otras no.
    Como las dos reglas de abajo se responden entre sí (sin sesión → /login,
    con sesión en /login → /dashboard), el resultado es una cadena de
    redirecciones que el router no llega a resolver: el click no reacciona.

    Para precargar basta con saber si hay cookie de sesión. No es una
    comprobación de autorización —una cookie inventada solo obtiene el armazón
    estático de la ruta— y la navegación real, que sí pasa por `getClaims()`,
    llega un instante después; además cada página protegida vuelve a exigir
    `requireUser`/`requirePermission` antes de consultar nada.
  */
  if (isPrefetch(request)) {
    if (!hasSessionCookie(request) && isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

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
  // `auth/` queda fuera, igual que `api`: los route handlers de `src/app/auth/*`
  // (el callback de OAuth y el `confirm` de los enlaces de correo) no son
  // páginas y no llevan prefijo de idioma. Sin excluirlos, next-intl redirigía
  // `/auth/confirm` a `/es/auth/confirm`, que no existe → 404, y ningún enlace
  // de invitación ni de recuperación llegaba a su destino.
  //
  // La barra final importa: `auth` a secas dejaría fuera también
  // `/auth-code-error`, que sí es una página localizada.
  matcher: ["/((?!api|trpc|auth/|_next|_vercel|.*\\..*).*)"],
};
