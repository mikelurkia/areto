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
};

export default withNextIntl(nextConfig);
