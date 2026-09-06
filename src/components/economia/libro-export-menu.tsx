"use client";

import { ExportMenu, type ExportData } from "@/components/export-menu";

/**
 * El libro fiscal es una página de servidor sin estado en cliente (a
 * diferencia de los `*-browser.tsx`): los datos ya vienen calculados, y
 * `onPrint` usa `window.print()` porque la propia página es el documento.
 */
export function LibroExportMenu({ filename, data }: { filename: string; data: ExportData }) {
  return <ExportMenu filename={filename} getData={() => data} onPrint={() => window.print()} />;
}
