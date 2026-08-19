/**
 * Solo rutas internas: un `from` absoluto sería un open redirect (mismo
 * criterio que `safeNext` en el login). `//` y `/\` también se rechazan:
 * el navegador los interpreta como URL absoluta a otro host aunque
 * empiecen por "/".
 */
export function resolveBackHref(from: string | undefined, fallback: string): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) {
    return fallback;
  }
  return from;
}
