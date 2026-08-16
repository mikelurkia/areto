/**
 * Origen de confianza para construir URLs absolutas de auth (emailRedirectTo,
 * redirectTo de OAuth). NUNCA derivar esto de cabeceras de la petición
 * (Host / X-Forwarded-Host): un cliente puede falsificarlas, lo que
 * permitiría redirigir el enlace de confirmación/token a un dominio propio
 * (host header injection → robo de sesión).
 */
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";

  throw new Error(
    "SITE_URL no está configurado. Es obligatorio en producción para construir " +
      "de forma segura los redirects de autenticación (ver .env.example).",
  );
}
