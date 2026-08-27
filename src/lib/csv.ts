/**
 * Caracteres que Excel/Sheets interpretan como inicio de fórmula si abren la
 * celda tal cual. Un campo que venga de datos del usuario (nombre, notas...)
 * y empiece por uno de ellos podría ejecutar código al abrir el CSV
 * exportado — se neutraliza anteponiendo un apóstrofo, que fuerza texto
 * literal sin cambiar lo que ve quien lo lee.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Envuelve siempre entre comillas y duplica las internas: así ni las comas ni
 * los saltos de línea de un campo rompen la fila.
 */
export function csvEscape(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Serializa cabeceras y filas a CSV, con CRLF entre filas. */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

/**
 * Genera el CSV y lo descarga. Solo cliente: usa `Blob`/`URL`/`document`.
 * El BOM UTF-8 inicial es lo que hace que Excel respete los acentos.
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const blob = new Blob(["\uFEFF" + toCsv(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
