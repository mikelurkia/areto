"use client";

import { type ReactNode, useState, useTransition } from "react";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  PrinterIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
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
import { downloadXlsx } from "@/lib/xlsx";

/**
 * El único sitio desde el que esta aplicación saca datos de una pantalla.
 *
 * Antes cada listado tenía su botón «Exportar CSV» con su propio `useTransition`
 * y su propia llamada a `downloadCsv`: nueve copias del mismo gesto que solo
 * coincidían por costumbre. Aquí la pantalla dice **qué** datos son —cabeceras
 * y filas, ya traducidas— y el menú decide **en qué formato** salen.
 *
 * Que CSV y Excel compartan la misma firma (`filename, headers, rows`) es lo
 * que hace que añadir un formato no obligue a tocar ninguna pantalla.
 */

export type ExportData = { headers: string[]; rows: string[][] };

export function ExportMenu({
  /** Sin extensión: la pone cada formato. */
  filename,
  /**
   * Se llama al pulsar, no al pintar: en los listados que filtran en cliente
   * las filas cambian con cada tecla, y en los que paginan en servidor esto es
   * una Server Action que va a buscarlas.
   */
  getData,
  /** Hoja imprimible de esta misma pantalla, si la tiene. */
  printHref,
  /** Para las pantallas que *son* el documento y se imprimen tal cual. */
  onPrint,
  /** Qué se va a exportar ("12 seleccionadas", "todo lo filtrado"). */
  scopeLabel,
  /** Entradas propias de una pantalla (p. ej. un segundo juego de datos). */
  children,
  label,
  variant = "outline",
  size,
}: {
  filename: string;
  getData: () => ExportData | Promise<ExportData>;
  printHref?: string;
  onPrint?: () => void;
  scopeLabel?: string;
  children?: ReactNode;
  /** Por defecto, «Exportar». */
  label?: string;
  variant?: "outline" | "ghost";
  size?: "sm";
}) {
  const t = useTranslations("Export");
  const [, startTransition] = useTransition();
  // Cuál de los dos formatos está en vuelo, no un booleano: con un `isPending`
  // compartido, pedir el CSV ponía también a girar el botón del Excel.
  const [running, setRunning] = useState<"csv" | "xlsx" | null>(null);

  function run(format: "csv" | "xlsx", save: (data: ExportData) => Promise<void> | void) {
    setRunning(format);
    startTransition(async () => {
      try {
        const data = await getData();
        // Un fichero de cero filas no dice nada: mejor avisar y no descargar.
        if (data.rows.length === 0) {
          toast.warning(t("empty"));
          return;
        }
        await save(data);
      } catch (error) {
        console.error("[export] no se pudo generar el fichero", error);
        toast.error(t("error"));
      } finally {
        setRunning(null);
      }
    });
  }

  const pending = running !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} size={size} disabled={pending} />}>
        {pending ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        {label ?? t("action")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {/* El ámbito es la única diferencia entre dos descargas que por lo
            demás se ven iguales, así que se dice antes de elegir formato. */}
        {scopeLabel ? (
          <>
            <DropdownMenuLabel className="text-muted-foreground font-normal">
              {scopeLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          onClick={() => run("csv", (d) => downloadCsv(`${filename}.csv`, d.headers, d.rows))}
        >
          <FileTextIcon />
          {t("csv")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => run("xlsx", (d) => downloadXlsx(`${filename}.xlsx`, d.headers, d.rows))}
        >
          <FileSpreadsheetIcon />
          {t("xlsx")}
        </DropdownMenuItem>
        {printHref || onPrint ? (
          <>
            <DropdownMenuSeparator />
            {/* Dos formas de imprimir: la hoja que vive en otra ruta va como
                enlace (es una página del servidor, no una descarga), y la
                pantalla que ya *es* el documento se imprime en el sitio. */}
            {printHref ? (
              <DropdownMenuItem render={<Link href={printHref} />}>
                <PrinterIcon />
                {t("print")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onPrint}>
                <PrinterIcon />
                {t("print")}
              </DropdownMenuItem>
            )}
          </>
        ) : null}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Encabezado para separar un segundo juego de datos dentro del menú. */
export function ExportMenuGroupLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-muted-foreground font-normal">
        {children}
      </DropdownMenuLabel>
    </>
  );
}
