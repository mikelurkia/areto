# Rescate: cuando algo del ciclo falla

Una receta por problema. Ninguna pierde trabajo; las que descartan algo lo dicen
antes.

## He commiteado en `main`

Git no lo impide, GitHub rechaza el push. Los commits se llevan con la rama:

```bash
git switch -c fix/lo-que-estaba-haciendo   # los commits viajan con ella
git log --oneline -3                       # comprobar que están aquí
git switch main
git reset --hard origin/main               # main vuelve al estado del servidor
git switch fix/lo-que-estaba-haciendo
```

El `reset --hard` descarta lo que hubiera en `main` local sin subir: hazlo
**después** de confirmar con el `git log` que los commits están en la rama nueva.

## Tengo cambios sin commitear en `main`

Los cambios del árbol de trabajo no pertenecen a ninguna rama, así que basta con
crearla: `git switch -c mi-rama` se los lleva consigo. No hace falta stash.

## El CI dice que el esquema no está sincronizado

Tocaste `src/db/schema.ts` sin generar la migración:

```bash
npm run db:generate
# revisa el .sql generado
npm run db:migrate
git add drizzle
git commit -m "Genera la migración de …"
```

## `db:check` falla: colisión de migraciones entre ramas

Dos ramas generaron su migración en paralelo y comparten número e `idx`. La
receta completa está en `references/migraciones.md`, sección «Dos ramas tocando
el esquema».

## `db:migrate` falla en local o en el CI, pero el `.sql` parece correcto

Lo más probable: `areto-dev` quedó desincronizada por un `db:push` anterior, así
que la migración intenta crear algo que ya existe. Opciones, de menos a más:

1. Mirar con `npm run db:studio` qué hay de más o de menos y decidir.
2. Aplicar a mano en el SQL Editor de Supabase (**solo en `areto-dev`**) el
   estado que la migración espera encontrar, y volver a lanzar `db:migrate`.
3. Si esa base de datos no tiene nada que valga la pena, vaciarla y reconstruir
   desde el historial: `npm run db:migrate` sobre el esquema limpio y
   `npm run db:seed`.

Nunca se edita un `.sql` ya mergeado para cuadrarlo con la base de datos: puede
estar aplicado en producción. Se corrige con una migración nueva encima.

## La migración de producción ha fallado a mitad

1. Lee el log de Actions: dice en qué sentencia paró.
2. Mira en Supabase (producción) en qué estado quedó el esquema. **No relances
   a ciegas.**
3. Drizzle no tiene «deshacer»: la corrección es una migración nueva que arregle
   lo que quedó a medias, en un PR normal.
4. Cuando esté claro, se puede relanzar a mano: **Actions → «Migrar producción»
   → Run workflow**. El disparo automático es un añadido, no el único camino.

## El backup previo ha fallado y no se ha migrado

Es el comportamiento buscado: sin red de seguridad no se toca la base de datos
real. Suele ser el secret `PROD_DATABASE_URL_DIRECT` (host, usuario
`postgres.<ref>` si es el session pooler) o la versión de `pg_dump` del runner,
que tiene que ser igual o mayor que el Postgres de Supabase. Arregla el backup y
relanza el workflow.

## El build de Vercel falla justo después de mergear

Probablemente salió antes que la migración y se encontró el esquema viejo. No es
una caída: producción sigue sirviendo el despliegue anterior. Espera a que
«Migrar producción» acabe en verde y pulsa **Redeploy** en Vercel. Si la que
falló es la migración, empieza por su log.

## El código nuevo rompe algo en producción

- **Rápido**: en Vercel, promocionar el despliegue anterior (rollback
  instantáneo, sin pasar por git).
- **Ordenado**: botón *Revert* del PR en GitHub → se mergea el PR inverso →
  Vercel despliega la vuelta atrás.

Si el problema es de esquema y no de código, revertir el código no lo arregla:
hace falta una migración nueva.

## Restaurar el backup cifrado

El artifact se descarga de la ejecución del workflow en Actions.

```bash
gpg --decrypt areto-prod-backup.sql.gz.gpg > areto-prod-backup.sql.gz
gunzip areto-prod-backup.sql.gz
# restaurar con psql sobre una base de datos NUEVA primero, y comprobar el
# contenido antes de plantearse tocar producción
```

El backup diario es una mitigación mientras el proyecto Supabase de producción
siga en el plan Free (sin PITR): cubre el borrado accidental, no un incidente
serio.
