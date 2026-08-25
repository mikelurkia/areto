/**
 * Lectura de los errores que devuelve Postgres a través de Drizzle.
 *
 * La trampa: Drizzle no propaga el error del driver tal cual, lo envuelve en un
 * `Error: Failed query: ...` y deja el original en `.cause`. Un
 * `"code" in error && error.code === "23505"` sobre el error de primer nivel no
 * casa nunca, así que el `catch` que debía traducir el choque a un mensaje
 * amable deja escapar la excepción y al usuario le sale la pantalla de error.
 *
 * Además, `postgres-js` llama al nombre de la restricción `constraint_name`, no
 * `constraint` como otros drivers.
 */

/** Códigos que nos interesa distinguir (los de la clase 23, integrity constraint violation). */
export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";

type PostgresErrorShape = { code?: unknown; constraint_name?: unknown };

/** El error de Postgres, esté en el primer nivel o envuelto por Drizzle en `.cause`. */
function postgresError(error: unknown): PostgresErrorShape | null {
  let candidate: unknown = error;
  // Basta con un par de saltos, pero se recorre la cadena por si Drizzle añade
  // algún envoltorio más adelante.
  for (let depth = 0; candidate && depth < 5; depth++) {
    if (typeof candidate === "object" && "code" in candidate) {
      return candidate as PostgresErrorShape;
    }
    candidate = candidate instanceof Error ? candidate.cause : undefined;
  }
  return null;
}

/** `true` si el error es la violación de restricción indicada. */
export function isPostgresError(error: unknown, code: string): boolean {
  return postgresError(error)?.code === code;
}

/**
 * Nombre de la restricción que se violó, para poder dar un mensaje concreto
 * ("ese DNI ya está en otra ficha") en vez de uno genérico. `null` si el error
 * no viene de Postgres o no trae el nombre.
 */
export function postgresConstraint(error: unknown): string | null {
  const constraint = postgresError(error)?.constraint_name;
  return typeof constraint === "string" ? constraint : null;
}
