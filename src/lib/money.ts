/**
 * Dinero del proyecto: enteros en céntimos, nunca float. Este módulo es el
 * único sitio donde se convierte entre lo que teclea el usuario y lo que se
 * guarda, y entre céntimos y el texto que se muestra.
 */

/**
 * Lee un importe tecleado ("45", "45,50", "45.50") y lo pasa a céntimos.
 * Devuelve `null` si viene vacío o no es un número: el campo está sin rellenar
 * o el valor es basura, y quien llama decide qué hacer con cada caso.
 */
export function readAmountCents(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/** Céntimos → "45,00 €" en el idioma de la petición. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
