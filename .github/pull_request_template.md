## Qué cambia y por qué

<!-- Dos líneas bastan. Si hay contexto que no se ve en el diff (una decisión,
     un error visto en producción), este es el sitio. -->

## Comprobado

- [ ] `npm run lint`, `npm run typecheck` y `npm run build` pasan en local
- [ ] Probado en local: camino feliz, caso vacío y un caso inválido
- [ ] Probado en la URL del Preview Deployment de este PR
- [ ] Si toca autenticación, permisos o `src/proxy.ts`: probado con cada rol implicado y también sin sesión

## Base de datos

- [ ] Este PR **no** toca `src/db/schema.ts` — nada más que comprobar
- [ ] Toca el esquema, y la migración está generada (`npm run db:generate`) y commiteada

Si trae migración, de qué tipo es:

- [ ] **Expand** (aditiva): compatible con el código que ahora mismo corre en producción
- [ ] **Contract** (destructiva): ya no queda código usando lo que se borra

> Al mergear, las migraciones se aplican **solas** a producción (workflow
> «Migrar producción», con backup cifrado previo). Revisa el `.sql` como si
> fueras a ejecutarlo tú a mano sobre los datos del club, porque es lo que va a
> pasar.
