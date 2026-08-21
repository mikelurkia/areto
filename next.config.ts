import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /**
   * Cache Components (PPR por defecto): cada ruta prerenderiza un armazón
   * estático y lo dinámico llega por streaming. Con esto activo, todo acceso a
   * datos de runtime (cookies de sesión, consultas sin cachear) tiene que estar
   * bajo un <Suspense> —los `loading.tsx` cuentan como tal— o Next lo marca
   * como error en desarrollo y en build.
   */
  cacheComponents: true,
  experimental: {
    // El formulario de inscripción envía hasta 3 ficheros (foto + DNI ambas
    // caras) de hasta 5MB cada uno (ver MAX_PHOTO_BYTES en inscripcion/actions.ts).
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Por defecto Next usa (núcleos de CPU - 1) workers para generar páginas
    // en `next build`; cada worker es un proceso Node aparte con su propio
    // pool de hasta 10 conexiones (`src/db/index.ts`), así que con muchos
    // núcleos el build satura el pooler de Supabase (visto como
    // "statement timeout" en queries triviales). El proyecto no tiene tantas
    // páginas dinámicas como para necesitar tanto paralelismo.
    cpus: 4,
  },
};

export default withNextIntl(nextConfig);
