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
