/** Fecha de hoy en formato `YYYY-MM-DD` (columnas `date` de Postgres). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
