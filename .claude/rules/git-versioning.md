## Flujo de trabajo con git

Invariantes, sin excepciones:

- `main` está protegida: nunca commitees ni empujes directamente a ella.
- Crea la rama (`feat/…`, `fix/…`, `chore/…`) **antes del primer commit**; si al
  arrancar una tarea la rama actual es `main`, eso es lo primero que haces.
- Un cambio en `src/db/schema.ts` va siempre con su migración generada
  (`pnpm run db:generate`) en el mismo PR: al mergear se aplica sola a
  producción.
- Solo una rama abierta a la vez toca el esquema (dos generarían el mismo
  número de migración).

El procedimiento completo —comandos, decisión expand/contract y qué hacer
cuando algo falla— está en la skill `desarrollar-funcionalidad`
(`.claude/skills/desarrollar-funcionalidad/`).
