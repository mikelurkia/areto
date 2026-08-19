/** Fecha y hora exacta (hh24:mi:ss) para trazabilidad/auditoría, p.ej. "19/08/2026, 14:23:05". */
export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
