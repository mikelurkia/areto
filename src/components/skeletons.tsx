import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Piezas reutilizables para los `loading.tsx`.
 *
 * Cada una imita la geometría del bloque real (mismos contenedores, mismas
 * alturas de fila y de botón) para que, al llegar el contenido, no salte nada.
 * Usan los componentes reales de tabla y tarjeta justamente por eso.
 *
 * Son decorativas: van marcadas con `aria-hidden`, porque el anuncio de la
 * navegación lo hace ya el route announcer de Next. Y son sincrónicas: un
 * fallback de Suspense no puede esperar a nada (ni a traducciones).
 */

/** Encabezado de listado: título, subtítulo y botones de acción a la derecha. */
export function PageHeaderSkeleton({
  actions = 0,
  titleWidth = "w-40",
}: {
  actions?: number;
  titleWidth?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className={`h-7 ${titleWidth}`} />
        <Skeleton className="h-4 w-64" />
      </div>
      {actions > 0 ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Encabezado de ficha: nombre, línea de metadatos y acciones.
 * `back` añade la flecha de volver en línea (ficha de equipo) y `media` reserva
 * el hueco del logo cuadrado (ficha de patrocinador).
 */
export function DetailHeaderSkeleton({
  back = false,
  media = false,
  actions = 2,
  iconActions = 0,
}: {
  back?: boolean;
  media?: boolean;
  actions?: number;
  iconActions?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4" aria-hidden>
      <div className="flex min-w-0 items-center gap-4">
        {back ? <Skeleton className="size-7 shrink-0 rounded-md" /> : null}
        {media ? <Skeleton className="size-14 shrink-0 rounded" /> : null}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      {actions > 0 || iconActions > 0 ? (
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={`action-${i}`} className="h-8 w-24" />
          ))}
          {Array.from({ length: iconActions }, (_, i) => (
            <Skeleton key={`icon-${i}`} className="size-7 rounded-md" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Enlace "volver a…" que las fichas llevan sobre el encabezado. */
export function BackLinkSkeleton() {
  return <Skeleton className="h-7 w-36" aria-hidden />;
}

/**
 * Encabezado de ficha con foto redonda a la izquierda (personas): avatar `lg`,
 * nombre, fila de etiquetas y acciones.
 */
export function ProfileHeaderSkeleton({ actions = 4 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4" aria-hidden>
      <div className="flex items-center gap-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-7 w-24" />
        ))}
      </div>
    </div>
  );
}

/** Barra de pestañas (variante `line`, la que usan las fichas). */
export function TabsSkeleton({ widths }: { widths: string[] }) {
  return (
    <div className="flex h-8 w-fit items-center gap-1 p-[3px]" aria-hidden>
      {widths.map((width, i) => (
        <Skeleton key={i} className={`mx-1.5 h-4 ${width}`} />
      ))}
    </div>
  );
}

/** Fila de filtros: buscador, selectores y acción final (exportar, imprimir). */
export function FiltersBarSkeleton({
  selects = 0,
  trailing = 0,
}: {
  selects?: number;
  trailing?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: selects }, (_, i) => (
        <Skeleton key={i} className="h-8 w-36" />
      ))}
      {trailing > 0 ? (
        <div className="ml-auto flex gap-2">
          {Array.from({ length: trailing }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Tabla con cabecera y filas de relleno. `columns` son clases de ancho, una por
 * columna; la última se alinea a la derecha porque en todos los listados es la
 * columna de acciones. `lines` a 2 para filas de dos líneas (nombre + DNI).
 */
export function TableSkeleton({
  columns,
  rows = 8,
  lines = 1,
  leading,
}: {
  columns: string[];
  rows?: number;
  lines?: 1 | 2;
  /** Columna estrecha inicial: casilla de selección o foto de la fila. */
  leading?: "checkbox" | "avatar";
}) {
  return (
    <Table aria-hidden>
      <TableHeader>
        <TableRow>
          {leading ? (
            <TableHead className="w-8">
              {leading === "checkbox" ? <Skeleton className="size-4 rounded-sm" /> : null}
            </TableHead>
          ) : null}
          {columns.map((width, i) => (
            <TableHead key={i} className={i === columns.length - 1 ? "text-right" : undefined}>
              <Skeleton className={`h-4 ${width} ${i === columns.length - 1 ? "ml-auto" : ""}`} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <TableRow key={rowIndex}>
            {leading ? (
              <TableCell className="w-8">
                <Skeleton
                  className={leading === "checkbox" ? "size-4 rounded-sm" : "size-8 rounded-full"}
                />
              </TableCell>
            ) : null}
            {columns.map((width, i) => (
              <TableCell key={i}>
                {i === columns.length - 1 ? (
                  <div className="flex justify-end gap-1">
                    <Skeleton className="size-7 rounded-md" />
                    <Skeleton className="size-7 rounded-md" />
                  </div>
                ) : lines === 2 && i === 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className={`h-4 ${width}`} />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ) : (
                  <Skeleton className={`h-4 ${width}`} />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Rejilla de KPIs (Personas, Equipos, Comprometido, Cobrado...). */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

/** Bloque de datos de ficha: etiqueta de sección y pares etiqueta/valor. */
export function FieldGridSkeleton({
  sections = 2,
  columns = 3,
  rows = 2,
}: {
  sections?: number;
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden
    >
      {Array.from({ length: sections }, (_, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <div
            className="grid gap-x-6 gap-y-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns * rows }, (_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tarjeta genérica con título y unas líneas de contenido. */
/**
 * Rejilla de alertas del panel: cuatro fichas con un número grande. No se sabe
 * de antemano cuántas tendrán aviso, así que reserva la rejilla completa.
 */
export function AlertTilesSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: tiles }, (_, i) => (
        <Card key={i} className="gap-2">
          <div className="flex items-start justify-between gap-3 px-4">
            <Skeleton className="h-9 w-12" />
            <Skeleton className="size-5 rounded-full" />
          </div>
          <div className="px-4">
            <Skeleton className="h-4 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card aria-hidden>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <div className="flex flex-col gap-3 px-4">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
