import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Invalidación de caché acotada, en un solo sitio.
 *
 * Antes cada acción terminaba en `revalidatePath("/", "layout")`. Funciona
 * siempre, y es justo por eso que se colaba: invalida la aplicación entera.
 * `revalidatePath` va por debajo contra las "soft tags" que Next deriva de la
 * ruta (`_N_T_/layout`, `_N_T_/[locale]/layout`, …), y la del layout raíz la
 * heredan TODAS las entradas de caché. Así que borrar una etiqueta de una
 * persona expiraba también los mensajes de i18n y los ajustes del club, que
 * están cacheados a `cacheLife("max")` precisamente porque no cambian.
 *
 * Dos cosas que no son evidentes y explican la forma de este módulo:
 *
 * 1. Las rutas se nombran por su ESTRUCTURA DE FICHEROS, no por la URL. El
 *    segmento `[locale]` va incluido, y los grupos de ruta —`(app)`, `(auth)`—
 *    no aparecen porque no forman parte de la ruta. `revalidatePath("/personas")`
 *    no casaría con nada.
 * 2. Como todas las rutas llevan un segmento dinámico, el segundo argumento es
 *    obligatorio. Con `"page"` una sola llamada cubre las dos versiones de
 *    idioma; el tipo importa además porque `"page"` invalida la hoja y deja en
 *    pie lo cacheado a nivel de layout, que es todo el objetivo del cambio.
 *
 * Los datos derivados que sí están cacheados (`getClubSettings`, los contadores
 * de integridad, las renovaciones…) NO se invalidan desde aquí: llevan su
 * propia `cacheTag` y se expiran con `updateTag`. Este módulo solo se ocupa de
 * las rutas.
 */
export const ROUTE = {
  dashboard: "/[locale]/dashboard",
  personas: "/[locale]/personas",
  personaFicha: "/[locale]/personas/[personId]",
  personasDuplicados: "/[locale]/personas/duplicados",
  equipos: "/[locale]/equipos",
  equipoFicha: "/[locale]/equipos/[teamId]",
  inscripciones: "/[locale]/inscripciones",
  inscripcionFicha: "/[locale]/inscripciones/[registrationId]",
  socios: "/[locale]/socios",
  socioFicha: "/[locale]/socios/[registrationId]",
  patrocinadores: "/[locale]/patrocinadores",
  patrocinadorFicha: "/[locale]/patrocinadores/[sponsorId]",
  patrocinadoresFacturas: "/[locale]/patrocinadores/facturas",
  patrocinadoresMuro: "/[locale]/patrocinadores-muro",
  cuotas: "/[locale]/cuotas",
  cuotaFicha: "/[locale]/cuotas/[remittanceId]",
  medico: "/[locale]/medico",
  medicoListado: "/[locale]/medico/listado",
  calendario: "/[locale]/calendario",
  club: "/[locale]/club",
} as const;

export type AppRoute = (typeof ROUTE)[keyof typeof ROUTE];

/** Invalida las páginas indicadas, en todos los idiomas. */
export function revalidateRoutes(...routes: readonly AppRoute[]): void {
  for (const route of routes) revalidatePath(route, "page");
}

/**
 * Invalida el armazón de la aplicación completo: el layout de `[locale]` y todo
 * lo que cuelga de él.
 *
 * Reservado para lo que de verdad cambia la aplicación entera —sesión, idioma,
 * permisos del usuario, temporada activa—, porque de eso depende lo que pinta
 * la barra lateral en cada página. Sigue dejando fuera el layout raíz, así que
 * los mensajes de i18n cacheados a `max` sobreviven.
 */
export function revalidateAppShell(): void {
  revalidatePath("/[locale]", "layout");
}
