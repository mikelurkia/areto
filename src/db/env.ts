import { config } from "dotenv";

/**
 * Carga las variables de entorno para los scripts que se ejecutan fuera de
 * Next (`db:seed`, `db:seed:demo`).
 *
 * `import "dotenv/config"` solo lee `.env`, pero el proyecto guarda la conexión
 * en `.env.local` (que es lo que lee Next y lo que dice el README), así que sin
 * esto los scripts arrancan sin `DATABASE_URL`. Se cargan los dos, con
 * `.env.local` por delante.
 *
 * Es un efecto de importación a propósito, y no una función: tiene que pasar
 * antes de que se evalúe `./index`, que lanza si falta `DATABASE_URL`. Un
 * `import` se resuelve siempre antes que cualquier línea del cuerpo del módulo.
 */
config({ path: [".env.local", ".env"], quiet: true });
