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

/**
 * El formateador de euros del proyecto, para quien ya tiene **euros** y no
 * céntimos: hoy solo las gráficas de patrocinadores, que reciben el importe ya
 * dividido porque el eje se dibuja con él.
 *
 * Devuelve la instancia de `Intl.NumberFormat` en vez de una función de
 * formateo porque `recharts` la usa como `tickFormatter` en cada marca del eje
 * y crear una instancia por marca es caro. Para todo lo demás, `formatCents`.
 */
export function currencyFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
}

/** Céntimos → "45,00 €" en el idioma de la petición. */
export function formatCents(cents: number, locale: string): string {
  return currencyFormatter(locale).format(cents / 100);
}
