@AGENTS.md

# Convenciones del proyecto

## Cache Components (`"use cache"`)

Uso actual, deliberado — línea base a mantener, no a ampliar por defecto:
`src/lib/club.ts`, `src/lib/registration-settings.ts`, `src/i18n/request.ts`,
`src/lib/data-integrity.ts`, `src/lib/season-renewals.ts`,
`src/components/public/public-footer.tsx`.

- No añadas `"use cache"` a una función nueva salvo que haya una razón
  concreta: el dato lo piden varias vistas, cambia poco, o el cómputo es caro.
  Si es solo "por si acaso", mejor déjala dinámica con `connection()`.
- Verifica siempre con `npm run build` tras tocar `"use cache"` o cualquier
  lectura de datos nueva en una página — es la única forma fiable de detectar
  errores de Cache Components (`tsc`/`eslint`/`next dev` no los señalan igual).
- No adoptar más funcionalidades experimentales de Next.js además de las ya
  usadas (Cache Components, Server Actions) hasta que esta superficie esté
  más asentada.

## Concurrencia de queries en páginas server-side

No metas una función de "agregación" (que por debajo dispara varias queries,
p. ej. `loadSeasonRenewals`) dentro del mismo `Promise.all` que las queries
directas de la página. Sácala a un `await` aparte (o a su propio `<Suspense>`
si el dato alimenta una sección aislada de la UI). Sumar demasiadas queries
concurrentes en una sola carga de página ha colgado el dashboard una vez ya
(el pooler transaccional de Supabase, Supavisor, no lo tolera bien) — trátalo
como un riesgo real, no teórico, en cualquier página nueva o existente que
dispare varias queries a la vez.

## Capa de composición de UI

Cada bloque visual repetido vive en un componente y solo ahí. Antes de escribir
un `div` con clases, busca en esta tabla:

| Necesitas | Usa | No |
|---|---|---|
| cabecera de página o de ficha | `PageHeader` (`size="compact"` en fichas y sub-páginas) | `h1` + `p` a mano |
| encabezado de sección | `SectionHeading` | `h2` con clases de versalitas |
| volver atrás | `BackLink` | `Button ghost` + `ArrowLeftIcon` |
| caja de sección | `Card` (`size="sm"` si es densa) | `rounded-lg border p-4` |
| métrica | `StatTile` | tríada de `div`s |
| vacío o "sin resultados" | `SectionPlaceholder` (`size="compact"` para "sin resultados") | `<p>` apagado suelto o caja punteada |
| estado de una entidad | `StatusBadge` + un tono de `status-tone.ts` | ternario que elige `variant` |
| aviso o llamada de atención | `Alert` | caja con `border-*/40 bg-*/5` |
| error de Server Action | `FormError` (no lleva margen propio) | `<p className="text-sm text-destructive mb-3">` |
| paginar | `PaginationBar` (+ `usePagedRows` si filtras en cliente) | `ui/pagination` a mano |
| tabla de más de 4 columnas | `priority` en `TableHead`/`TableCell` | nada, y que haga scroll horizontal |

Y tres invariantes:

- La raíz de una página de la app es `flex flex-1 flex-col gap-6`.
- Toda ruta de la app lleva su `loading.tsx` compuesto con piezas de
  `skeletons.tsx`, **con la geometría de su página** — filtros, sub-navegación y
  número de columnas incluidos. Un esqueleto que no cuadra es peor que ninguno.
  Las rutas imprimibles reservan su hoja A4 con `PrintableSheetSkeleton`.
- Cualquier cambio en `ui/table.tsx` o en los bloques `print:` de `globals.css`
  se verifica con **vista previa de impresión del acta de equipo y del listado
  médico** antes de mergear.

Cuatro de estas convenciones las vigila ESLint (colores crudos, `dark:` con
color a mano, cabecera a mano e iconos de lucide sin sufijo `Icon`): están en
`eslint.config.mjs`, comentadas una por una. Entran como `error` y el árbol está
limpio, así que si `npm run lint` señala una, es nueva. La solución es usar el
componente, no un `eslint-disable`. Un componente recién traído del registry de
shadcn puede llegar con colores crudos: se mapean a tokens al añadirlo.

## Flujo de trabajo con git

Invariantes, sin excepciones:

- `main` está protegida: nunca commitees ni empujes directamente a ella.
- Crea la rama (`feat/…`, `fix/…`, `chore/…`) **antes del primer commit**; si al
  arrancar una tarea la rama actual es `main`, eso es lo primero que haces.
- Un cambio en `src/db/schema.ts` va siempre con su migración generada
  (`npm run db:generate`) en el mismo PR: al mergear se aplica sola a
  producción.
- Solo una rama abierta a la vez toca el esquema (dos generarían el mismo
  número de migración).

El procedimiento completo —comandos, decisión expand/contract y qué hacer
cuando algo falla— está en la skill `desarrollar-funcionalidad`
(`.claude/skills/desarrollar-funcionalidad/`).

## Coste de contexto

Cada turno reenvía el contexto entero: lo que entra en contexto se paga
multiplicado por los turnos que queden de sesión. Reglas medidas sobre el
histórico real de este proyecto (contexto medio de 205k/turno, sesiones de
hasta 744k):

- **Una tarea, una sesión.** `/clear` al terminar cada funcionalidad. Una sola
  sesión de 767 turnos consumió el 29% del gasto histórico del proyecto.
- **Nunca `Read` sobre imágenes o PDFs completos.** Recorta o reescala antes y
  lee una imagen por vez: una captura a pantalla completa se queda en contexto
  el resto de la sesión.
- **Verificación visual: texto antes que píxeles.** `get_page_text` / `read_page`
  antes que `screenshot`, y `read_console_messages` siempre con `pattern`,
  nunca el volcado entero.
- **Búsquedas amplias, al subagente `Explore`**, para que devuelva la conclusión
  y no los volcados de ficheros.
- **`Grep`/`Glob` antes que `Read` completo**, y `offset`/`limit` cuando ya se
  sabe la zona. `src/db/schema.ts` y `messages/*.json` son grandes y se releen
  con demasiada frecuencia.
- **Salidas de comandos acotadas.** `npm run build` y `npm run lint` solo cuando
  toca verificar de verdad, filtrando la salida (`| tail -40`,
  `2>&1 | grep -E "error|warn"`).
- **Sin `cd` al proyecto en cada comando**: el cwd ya es el del proyecto.
