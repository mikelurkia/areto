---
name: desarrollar-funcionalidad
description: Procedimiento de desarrollo de este proyecto (Areto) — crear la rama, trabajar en local, generar migraciones de Drizzle, comprobar antes de subir y abrir el PR a main. Úsalo al empezar cualquier funcionalidad o arreglo en este repositorio, antes de tocar `src/db/schema.ts`, al preparar el PR, y cuando algo del ciclo falle: CI en rojo, migración de producción fallida, o colisión de migraciones entre ramas.
---

# Desarrollar una funcionalidad en Areto

Guión operativo del ciclo completo. Las reglas invariantes (nunca empujar a
`main`, esquema y migración en el mismo PR) están en `CLAUDE.md`, que se carga
siempre; aquí está el procedimiento y qué hacer cuando algo se rompe.

## Ficheros de referencia

Cárgalos **solo cuando la tarea lo pida**:

| Fichero | Cuándo leerlo |
|---------|---------------|
| `references/migraciones.md` | Cualquier cambio en `src/db/schema.ts`: cómo se genera, qué es expand/contract, por qué el orden importa, dos ramas tocando el esquema |
| `references/rescate.md` | Algo ha fallado: commits en `main`, CI en rojo, migración de producción a medias, `db:push` que desincronizó `areto-dev`, rollback |

## Antes de tocar código

```bash
git branch --show-current    # ¿dónde estoy?
```

Si la respuesta es `main`, **crea la rama antes del primer commit** — git te
deja commitear en `main`, es GitHub quien rechaza el push, así que el error no
se ve hasta el final. Si ya hay commits o cambios en `main`, ve a
`references/rescate.md`.

```bash
git switch main
git pull
git switch -c feat/nombre-corto    # o fix/…, chore/…
```

Varias ramas abiertas a la vez, sin problema. La única restricción: que solo
una toque `src/db/schema.ts` (ver `references/migraciones.md`).

## El ciclo

1. **Trabajar en local.** `npm run dev`. En la red corporativa de ULMA, antes:
   `npm run dev:route` en un PowerShell como administrador con el hotspot
   conectado (el puerto 6543 del pooler está filtrado; el README lo detalla).
   Los datos son de `areto-dev`: se pueden romper, `npm run db:seed` resiembra.

2. **Si el cambio toca el esquema**, y solo entonces:

   ```bash
   npm run db:generate    # escribe drizzle/00XX_*.sql desde schema.ts
   npm run db:migrate     # lo aplica a areto-dev
   ```

   Lee el `.sql` generado antes de seguir y decide si es expand o contract
   (abajo). El `.sql` y el `meta/` actualizado se commitean: son ellos los que
   llegan a producción, no `schema.ts`.

3. **Comprobar antes de subir.** Las tres, en este orden:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

   `build` no es opcional: con `cacheComponents: true` es el único que detecta
   lecturas de datos dinámicos fuera de `<Suspense>`, y ejecuta consultas
   reales. `tsc`, `eslint` y `next dev` no lo señalan.

4. **Commit y push.**

   ```bash
   git add -A
   git commit -m "Añade …"
   git push -u origin feat/nombre-corto    # -u solo la primera vez
   ```

5. **Abrir el PR** hacia `main` con el enlace que imprime el push. La plantilla
   (`.github/pull_request_template.md`) lleva el checklist. Con el PR abierto
   corren el CI y el Preview Deployment de Vercel, y se repiten en cada push.
   Prueba en la URL del Preview, no solo en local: compila en modo producción.

## Decisión de esquema: expand o contract

Al mergear, las migraciones **se aplican solas a producción** (con backup
cifrado previo). Antes de escribir la migración, decide cuál de las dos es:

- **Expand** — solo añade (tabla, columna opcional, índice) y rellena datos
  existentes. Compatible con el código viejo que sigue sirviendo mientras el
  nuevo se despliega. Va con el código que la necesita, en el mismo PR.
- **Contract** — borra o endurece lo viejo (`drop column`, `set not null`,
  renombrados). Solo cuando ya no queda código usándolo, y por eso va en un
  **PR posterior**, nunca en el mismo que introduce el reemplazo.

Si dudas, es expand: partir el cambio en dos PRs nunca ha roto nada; juntarlos,
sí. El detalle y un ejemplo real del repo, en `references/migraciones.md`.

## Si el CI se pone en rojo

| Falla | Qué significa y qué hacer |
|-------|---------------------------|
| Comprobar que el esquema y las migraciones están sincronizados | Tocaste `schema.ts` sin generar la migración: `npm run db:generate`, revisa el `.sql`, commitéalo |
| `db:check` | Historial incoherente, casi siempre dos ramas que generaron migración en paralelo → `references/rescate.md` |
| Aviso de SQL destructivo (no bloquea) | Comprueba que ya no queda código usando lo que se borra; si queda, parte el PR en expand + contract |
| `build` | Suele ser una lectura de datos dinámicos fuera de `<Suspense>` (ver la sección de Cache Components en `CLAUDE.md`) |
| `db:migrate` | La migración no aplica limpiamente sobre `areto-dev`; si esa base de datos quedó desincronizada por un `db:push`, ve a `references/rescate.md` |

## Tras mergear

No hay nada que lanzar a mano. Comprueba una vez:

- **Actions**: si el PR traía ficheros en `drizzle/`, «Migrar producción» tiene
  que estar en verde, con su artifact de backup.
- **Vercel**: el despliegue de Production, terminado. Si falló, lo más probable
  es que haya salido antes que la migración → espera a que acabe y pulsa
  *Redeploy*. No es una caída: sigue sirviendo el despliegue anterior.

Y recoge:

```bash
git switch main
git pull
git fetch --prune
git branch -d feat/nombre-corto
```
