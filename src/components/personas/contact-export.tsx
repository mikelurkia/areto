"use client";

import { useState, useTransition } from "react";
import {
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  PrinterIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { exportContactRows } from "@/app/[locale]/(app)/personas/list-actions";
import { ExportMenuGroup } from "@/components/export-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { downloadCsv } from "@/lib/csv";
import { downloadXlsx } from "@/lib/xlsx";

/**
 * Los datos de contacto son el único juego de datos que no vive ya en el
 * navegador: la pantalla solo tiene la página que se ve, así que hay que ir a
 * buscarlos. De ahí que aquí haya un `getData` asíncrono y no un array.
 *
 * El ámbito llega como función y no como valor porque se evalúa al pulsar:
 * entre que se pinta el botón y alguien lo usa, la selección o los filtros
 * pueden haber cambiado.
 */
export type ContactExportScope =
  | { ids: string[] }
  | { searchParams: Record<string, string> };

/**
 * La misma selección, en la ruta imprimible. Va por URL porque el documento es
 * una página de servidor: o los ids marcados, o los filtros de pantalla.
 */
export function contactPrintHref(scope: ContactExportScope): string {
  const params = new URLSearchParams(
    "ids" in scope ? { ids: scope.ids.join(",") } : scope.searchParams,
  );
  // La hoja sale entera, así que el número de página del listado sobra.
  params.delete("pagina");
  const query = params.toString();
  return query ? `/personas/contactos?${query}` : "/personas/contactos";
}

/** Qué descarga está en vuelo, para que el spinner salga solo en su botón. */
export type ContactExportFormat = "csv" | "xlsx";

/**
 * Las dos descargas sueltas, para el diálogo del equipo, que las pinta como
 * botones en línea en vez de como menú.
 */
export function useContactExport(getScope: () => ContactExportScope) {
  const t = useTranslations("Personas");
  const [, startTransition] = useTransition();
  // Cuál de los dos formatos está en vuelo, no un booleano: con un `isPending`
  // compartido, pedir el CSV ponía también a girar el botón del Excel.
  const [running, setRunning] = useState<ContactExportFormat | null>(null);

  function run(format: ContactExportFormat) {
    setRunning(format);
    startTransition(async () => {
      try {
        const { filename, headers, rows } = await exportContactRows(getScope());
        if (rows.length === 0) {
          toast.warning(t("contactExportEmpty"));
          return;
        }
        if (format === "csv") downloadCsv(`${filename}.csv`, headers, rows);
        else await downloadXlsx(`${filename}.xlsx`, headers, rows);
      } catch (error) {
        // Una excepción dentro de `startTransition` no se traga: sube al error
        // boundary y deja la pantalla en blanco. Tumbar la ficha del equipo
        // porque ha caducado la sesión sería peor que un aviso.
        console.error("[contact-export] no se pudo generar el fichero", error);
        toast.error(t("contactExportError"));
      } finally {
        setRunning(null);
      }
    });
  }

  return {
    running,
    pending: running !== null,
    exportCsv: () => run("csv"),
    exportXlsx: () => run("xlsx"),
  };
}

/**
 * Los datos de contacto como entradas de un menú, no como menú propio: en el
 * listado de personas cuelgan del mismo «Exportar» que el listado, porque son
 * dos juegos de datos de la misma pantalla y no dos botones distintos.
 */
export function ContactExportItems({
  getScope,
  scopeLabel,
}: {
  getScope: () => ContactExportScope;
  scopeLabel: string;
}) {
  const t = useTranslations("Personas");
  const tExport = useTranslations("Export");
  const { running, exportCsv, exportXlsx } = useContactExport(getScope);

  return (
    <ExportMenuGroup
      label={
        <>
          {t("contactExportAction")} · {scopeLabel}
        </>
      }
    >
      <DropdownMenuItem onClick={exportCsv}>
        {running === "csv" ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <FileTextIcon />
        )}
        {tExport("csv")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={exportXlsx}>
        {running === "xlsx" ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <FileSpreadsheetIcon />
        )}
        {tExport("xlsx")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href={contactPrintHref(getScope())} />}>
        <PrinterIcon />
        {tExport("print")}
      </DropdownMenuItem>
    </ExportMenuGroup>
  );
}
