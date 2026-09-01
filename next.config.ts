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
  /**
   * Contadores derivados del panel: integridad, duplicados y renovaciones.
   * Su frescura la garantizan los `updateTag` de cada acción que los altera, no
   * el reloj, así que `revalidate` puede ser largo. Con `cacheLife("minutes")`
   * —revalidate de 60s— cada entrada se reescribía en segundo plano cada minuto
   * que hubiera tráfico, y cada reescritura es una escritura ISR facturable que
   * no aportaba nada. El `expire` de un día acota lo que entra por fuera de la
   * aplicación (importaciones, edición directa en la base).
   */
  cacheLife: {
    derivados: {
      stale: 300, // 5 min
      revalidate: 3600, // 1 h
      expire: 86400, // 1 día
    },
  },
  // El binario nativo de `sharp` para Linux vive en paquetes aparte
  // (`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`) que el file
  // tracing de Next no detecta solo (sharp lo carga con dlopen, no con un
  // require estático). Sin esto, cualquier función serverless que importe
  // (aunque sea transitivamente, vía una server action) `resizeImageToWebp`
  // se despliega sin el .so y revienta en runtime con
  // ERR_DLOPEN_FAILED — visto en producción como "Connection closed" en
  // páginas que ni usan la foto (p. ej. la ficha de persona, que solo
  // importa acciones del mismo módulo que sí redimensiona imágenes).
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/sharp/**/*",
      "node_modules/@img/sharp-linux-x64/**/*",
      "node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  experimental: {
    // OJO: esto solo levanta el límite de Next. El de la plataforma manda y
    // es MUY inferior: una función de Vercel rechaza con 413
    // (FUNCTION_PAYLOAD_TOO_LARGE) cualquier petición de más de 4,5MB de
    // cuerpo, y lo hace antes de ejecutar una sola línea, así que la Server
    // Action no puede ni capturarlo ni devolver un error decente.
    // https://vercel.com/docs/functions/limitations#request-body-size
    // Por eso el formulario de inscripción reduce las 3 fotos en el navegador
    // antes de enviarlas (src/lib/image-downscale.ts): sin eso, cualquier
    // móvil moderno se pasa del límite y la inscripción no llega nunca.
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
