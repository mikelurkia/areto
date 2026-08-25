import { cn } from "@/lib/utils";

/**
 * Una hoja A4 de verdad: 210×297mm con 14mm de margen, en pantalla y en papel.
 *
 * La clave es que todas las medidas son absolutas (mm para la caja, pt para la
 * tipografía). El navegador las resuelve igual en los dos medios —1pt = 1,333px
 * en pantalla, 1/72" impreso—, así que el documento rompe las líneas en el mismo
 * sitio y lo que se ve es literalmente lo que sale por la impresora.
 *
 * El margen va como padding de la hoja, no como margen de `@page`: así hay una
 * sola caja que se comporta igual en ambos medios, en vez de dos.
 *
 * Escala tipográfica del documento (absoluta, no la de la app):
 *   11pt  título          10pt  importes destacados
 *    8pt  cuerpo y tablas  7pt  metadatos de cabecera
 *
 * Es densidad de papel, no de pantalla: a 8pt el texto se ve pequeño en el
 * monitor a propósito, porque es exactamente el tamaño al que va a imprimirse.
 * Para leerlo cómodo en pantalla está el zoom del navegador.
 */
export function PrintableSheet({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    /*
     * Lienzo: saca el fondo grisáceo a sangre (compensando el padding del
     * <main>), centra la hoja y la deja desplazable en viewports estrechos —
     * 210mm son 794px, que no caben en un móvil.
     */
    <div
      data-slot="printable-sheet-canvas"
      className="-mx-4 flex justify-center overflow-x-auto bg-muted/40 p-6 md:-mx-6 print:m-0 print:overflow-visible print:bg-transparent print:p-0"
    >
      <div
        data-slot="printable-sheet"
        className={cn(
          "flex w-[210mm] min-h-[297mm] shrink-0 flex-col gap-[9pt] p-[14mm] text-[8pt] shadow-md",
          /*
           * Impreso, `w-full` en vez de los 210mm explícitos: con `@page
           * { margin: 0 }` la caja de página ya es 210mm, y repetir la medida
           * puede desbordar por redondeo subpíxel y sacar una página en blanco.
           * `min-h-0` evita esa misma página extra cuando el documento es corto.
           */
          "print:w-full print:min-h-0 print:shadow-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
