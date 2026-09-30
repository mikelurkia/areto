import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

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
 * cada petición.
 *
 * `/contrasena` es pública porque se llega con el token del enlace de
 * invitación o de recuperación, todavía sin sesión.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/contrasena",
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
 * Enruta el idioma (next-intl) y protege las rutas internas.
 *
 * Solo mira si hay cookie de sesión de Better Auth, sin validarla: no toca la
 * base de datos en cada petición (y el sidebar dispara decenas de prefetch a la
 * vez). Una cookie inventada solo obtiene el armazón estático de la ruta; la
 * comprobación de verdad la hace `requireUser`/`requirePermission` en cada
 * página antes de consultar nada.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (response.status >= 300 && response.status < 400) return response;

  const { locale, rest: pathname } = splitLocale(request.nextUrl.pathname);

  // Sin sesión en una ruta protegida → al login (recordando el destino).
  //
  // La regla inversa (con sesión en /login → al panel) la aplica la página de
  // login, que sí valida la sesión: aquí una cookie caducada rebotaría sin fin
  // entre /login y el `requireUser` del panel.
  if (!getSessionCookie(request) && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // `api` queda fuera: los route handlers (Better Auth en `/api/auth/*`) no son
  // páginas y no llevan prefijo de idioma.
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
