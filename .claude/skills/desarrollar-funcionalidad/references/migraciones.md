# Migraciones (Drizzle + Supabase)

## Las tres piezas

| Pieza | Papel |
|-------|-------|
| `src/db/schema.ts` | **Fuente de verdad**: cómo debe ser el esquema. Es lo que se edita. |
| `drizzle/00XX_*.sql` | **Historial**: lista ordenada e inmutable de cambios. Se generan; solo se escriben a mano los de datos (ej. `0004_backfill_seasons.sql`). |
| `drizzle/meta/_journal.json` | **Registro**: qué migraciones existen y en qué orden. Drizzle lo usa para saber qué falta por aplicar en cada base de datos. |

Lo que llega a producción es el `.sql` más el `meta/`, no `schema.ts`. Un cambio
de esquema sin migración generada no llega a ninguna parte (y el CI lo para).

## Comandos

| Comando | Qué hace | Cuándo |
|---------|----------|--------|
| `npm run db:generate` | Compara `schema.ts` con el historial y escribe el `.sql` de la diferencia. No toca ninguna base de datos. | Siempre que cambie el esquema |
| `npm run db:migrate` | Aplica las migraciones pendientes a la base de datos de `DATABASE_URL` | En local, en el CI y en producción |
| `npm run db:check` | Valida la coherencia del historial (colisiones de índice) | Lo corre el CI; útil en local tras un rebase |
| `npm run db:push` | Empuja `schema.ts` directo a la base de datos **sin dejar migración** | Solo prototipos desechables; ver la trampa |
| `npm run db:studio` | Explorador visual de la base de datos | Para mirar datos |
| `npm run db:seed` | Datos iniciales (temporada y equipos de ejemplo) | Tras crear o vaciar `areto-dev` |

## La trampa de `db:push`

`db:push` cambia la base de datos pero no deja rastro en el historial. Si se usa
en `areto-dev` y luego se genera una migración, esa base de datos está
«adelantada» respecto al SQL y el `db:migrate` del CI falla con errores raros
(una columna que ya existe). Si el cambio va a acabar en un PR, se usa
`db:generate` + `db:migrate` desde el principio.

## `areto-dev` es compartida

La usan el portátil, el CI de **todos** los PRs y todos los Preview Deployments.
Consecuencias reales:

- El CI de un PR aplica sus migraciones a esa base de datos aunque el PR no se
  mergee nunca. Con cambios aditivos no pasa nada; un `drop column` afecta a las
  demás ramas y al entorno local.
- Un Preview puede estar corriendo contra un esquema más nuevo que su código.

## Expand / contract, y por qué el orden importa

Al mergear se disparan dos caminos independientes: Vercel construye y publica el
código, y GitHub Actions hace backup y aplica las migraciones. Arrancan a la vez
y ninguno espera al otro.

El esquema tiene que llegar primero, y no es una preferencia: con
`cacheComponents: true` (`next.config.ts`), `next build` ejecuta consultas
reales, así que un build de Production contra el esquema viejo revienta al
prerenderizar cualquier página que use lo nuevo. La migración tarda ~1 min y el
build varios, de modo que en la práctica llega antes.

Aun así hay unos minutos en los que el código viejo sigue sirviendo con el
esquema ya nuevo. De ahí la disciplina:

- **Expand**: añadir y rellenar. Compatible con el código viejo. Va con el
  código que la necesita.
- **Contract**: borrar o endurecer. En un PR posterior, cuando ya no queda
  código usando lo viejo.

El ejemplo real está en el historial del repo, con las temporadas:

1. `0003_add_seasons.sql` — crea la tabla y las columnas nuevas (opcionales).
2. `0004_backfill_seasons.sql` — traslada los datos del campo de texto antiguo.
3. `0005_drop_legacy_season_columns.sql` — solo entonces, `set not null` y
   `drop column` de lo viejo.

## Dos ramas tocando el esquema

Se puede tener cuantas ramas se quieran, pero **solo una debería tocar el
esquema a la vez**, por dos razones:

- **Colisión de numeración.** Las dos generarían `0061_*.sql` y el mismo `idx`
  en `drizzle/meta/_journal.json`. `db:check` lo detecta en el CI.
- **La base de datos compartida**, arriba.

Si ya ha pasado, la rama que se mergea segunda se arregla así:

```bash
git switch mi-rama
git fetch origin
git rebase origin/main          # o: git merge main
git rm drizzle/00XX_mi-migracion.sql
git checkout origin/main -- drizzle/meta   # descarta el meta/ propio
npm run db:generate                        # regenera con el número siguiente
npm run db:check
npm run db:migrate
```

Revisa el `.sql` nuevo antes de commitear: al regenerar sobre un esquema base
distinto, el contenido puede no ser idéntico al que tenías.
