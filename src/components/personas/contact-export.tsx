"use client";

import { useTransition } from "react";
import { ContactIcon, FileSpreadsheetIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  exportContactRows,
  exportContactWorkbook,
} from "@/app/[locale]/(app)/personas/list-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/csv";

/**
 * La descarga de los datos de contacto, en un sitio: la usan el listado de
 * personas (con sus filtros y su selección) y el diálogo de la ficha de equipo.
 *
 * El ámbito llega como una función y no como un valor porque se evalúa al
 * pulsar: entre que se pinta el botón y alguien lo usa, la selección o los
 * filtros pueden haber cambiado.
 */
export type ContactExportScope =
  | { ids: string[] }
  | { searchParams: Record<string, string> };

// `Uint8Array<ArrayBuffer>` y no `Uint8Array` a secas: `Blob` no acepta una
// vista que pudiera estar respaldada por un `SharedArrayBuffer`.
function saveFile(
  filename: string,
  bytes: Uint8Array<ArrayBuffer>,
  mimeType: string,
): void {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useContactExport(getScope: () => ContactExportScope) {
  const t = useTranslations("Personas");
  const [pending, startTransition] = useTransition();

  /** Ni el CSV ni el Excel de cero filas dicen nada: mejor avisar y no descargar. */
  function warnIfEmpty(count: number): boolean {
    if (count > 0) return false;
    toast.warning(t("contactExportEmpty"));
    return true;
  }

  /**
   * Una excepción dentro de `startTransition` no se traga: sube al error
   * boundary y deja la pantalla en blanco. Aquí eso significaría tumbar el
   * listado —o la ficha del equipo— porque ha caducado la sesión o ha fallado
   * la generación del Excel, cuando basta con un aviso.
   */
  function run(task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        console.error("[contact-export] no se pudo generar el fichero", error);
        toast.error(t("contactExportError"));
      }
    });
  }

  function exportCsv() {
    run(async () => {
      const { filename, headers, rows } = await exportContactRows(getScope());
      if (warnIfEmpty(rows.length)) return;
      downloadCsv(filename, headers, rows);
    });
  }

  function exportXlsx() {
    run(async () => {
      const result = await exportContactWorkbook(getScope());
      if (warnIfEmpty(result.rowCount)) return;
      // El fichero viaja en base64 porque una Server Action no serializa
      // binario; `atob` lo devuelve como cadena de bytes.
      const binary = atob(result.base64);
      const bytes = Uint8Array.from<string>(binary, (char) => char.charCodeAt(0));
      saveFile(
        result.filename,
        bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    });
  }

  return { pending, exportCsv, exportXlsx };
}

/**
 * Botón con menú para el listado de personas. El subtítulo dice a quién va a
 * exportar —la selección o todo lo filtrado—, porque es la única diferencia
 * entre dos descargas que por lo demás se ven iguales.
 */
export function ContactExportMenu({
  getScope,
  scopeLabel,
}: {
  getScope: () => ContactExportScope;
  scopeLabel: string;
}) {
  const t = useTranslations("Personas");
  const { pending, exportCsv, exportXlsx } = useContactExport(getScope);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" disabled={pending} />}
      >
        {pending ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <ContactIcon data-icon="inline-start" />
        )}
        {t("contactExportAction")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-muted-foreground font-normal">
          {scopeLabel}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportCsv}>
          <FileTextIcon />
          {t("contactExportCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportXlsx}>
          <FileSpreadsheetIcon />
          {t("contactExportXlsx")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
