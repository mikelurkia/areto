/** Utilidades puras de fecha/rejilla para la vista de mes de Calendario. */

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** Primer día del mes indicado por `monthKey` ("YYYY-MM"); si no es válido,
 * usa el primer día del mes de `fallback`. */
export function parseMonthKey(monthKey: string | undefined, fallback: Date): Date {
  if (monthKey && MONTH_KEY_RE.test(monthKey)) {
    const [year, month] = monthKey.split("-").map(Number);
    if (month >= 1 && month <= 12) return new Date(year, month - 1, 1);
  }
  return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
}

export function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const date = parseMonthKey(monthKey, new Date());
  return formatMonthKey(addMonths(date, delta));
}

/**
 * Abreviaturas de lunes a domingo para el locale dado, derivadas con `Intl`
 * en vez de hardcodearlas (evita 7 claves i18n más y sigue el mismo patrón
 * que ya usa `formatWeekendRange` en la página de calendario). Se calculan
 * sobre una semana de referencia conocida (lunes 2024-01-01).
 */
export function getWeekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const referenceMonday = new Date(2024, 0, 1); // lunes
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(referenceMonday);
    d.setDate(d.getDate() + i);
    return formatter.format(d);
  });
}

export type MonthGridDay = { date: string; inCurrentMonth: boolean };

/**
 * Rejilla de 6 semanas × 7 días (lunes-domingo, fijo, no depende del locale)
 * para el mes de `monthKey`. Siempre 6 filas para que la altura no cambie al
 * navegar entre meses (algunos meses necesitan 6 semanas para completarse).
 */
export function getMonthGridWeeks(monthKey: string): MonthGridDay[][] {
  const firstOfMonth = parseMonthKey(monthKey, new Date());
  const targetMonth = firstOfMonth.getMonth();

  // getDay(): 0 = domingo ... 6 = sábado. Lo convertimos a índice lunes=0.
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - mondayIndex);

  const weeks: MonthGridDay[][] = [];
  const cursor = new Date(gridStart);
  for (let week = 0; week < 6; week++) {
    const days: MonthGridDay[] = [];
    for (let day = 0; day < 7; day++) {
      days.push({
        date: toDateInputValue(cursor),
        inCurrentMonth: cursor.getMonth() === targetMonth,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}
