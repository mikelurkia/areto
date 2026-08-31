/**
 * El gemelo de `downloadCsv` para Excel: mismas cabeceras, mismas filas, otro
 * envoltorio. Que las dos funciones tengan la misma firma es lo que permite
 * que `ExportMenu` ofrezca los dos formatos sin que cada pantalla sepa nada
 * del serializador.
 *
 * El generador se carga solo cuando alguien pide el Excel (`import()`
 * dinámico): son ~70 KB que no tienen por qué viajar con cada listado.
 */
export async function downloadXlsx(
  filename: string,
  headers: readonly string[],
  rows: readonly string[][],
): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  /*
   * Todo como texto a propósito. En cuanto Excel decide el tipo por su cuenta,
   * un código postal pierde el cero inicial, un DNI que solo lleva dígitos se
   * convierte en número y una fecha se reinterpreta según el idioma de quien
   * abre el fichero. Aquí sale exactamente lo que hay en la base de datos —el
   * mismo criterio que el `csvEscape` de `csv.ts`, que también antepone un
   * apóstrofo antes que dejar que la hoja de cálculo interprete.
   */
  const sheet = [
    headers.map((value) => ({ value, type: String, fontWeight: "bold" as const })),
    ...rows.map((row) => row.map((value) => ({ value, type: String }))),
  ];

  const blob = await writeXlsxFile(sheet, {
    // Sin anchos, Excel abre todas las columnas colapsadas al ancho por
    // defecto y la primera lectura es ilegible.
    columns: headers.map(() => ({ width: 24 })),
  }).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
