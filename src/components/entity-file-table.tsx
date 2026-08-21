import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EntityFileTableColumn<T> = {
  header: ReactNode;
  cell: (item: T) => ReactNode;
  className?: string;
};

/**
 * Tabla de "listado con fichero adjunto y acciones", compartida por las
 * pestañas de titulaciones/médico/lesiones/documentos de la ficha de
 * persona: mismas columnas fijas de "ver fichero" y acciones a la derecha,
 * solo cambian las columnas propias de cada entidad (vía `columns`).
 */
export function EntityFileTable<T extends { id: string }>({
  items,
  columns,
  fileUrl,
  viewFileLabel,
  canManage,
  actionsLabel,
  renderActions,
}: {
  items: readonly T[];
  columns: EntityFileTableColumn<T>[];
  fileUrl: (item: T) => string | null;
  viewFileLabel: ReactNode;
  canManage: boolean;
  actionsLabel: ReactNode;
  renderActions: (item: T) => ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column, index) => (
            <TableHead key={index}>{column.header}</TableHead>
          ))}
          <TableHead>{viewFileLabel}</TableHead>
          {canManage ? (
            <TableHead className="text-right print:hidden">{actionsLabel}</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const url = fileUrl(item);
          return (
            <TableRow key={item.id}>
              {columns.map((column, index) => (
                <TableCell key={index} className={column.className}>
                  {column.cell(item)}
                </TableCell>
              ))}
              <TableCell>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {viewFileLabel}
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
              {canManage ? (
                <TableCell className="flex justify-end gap-1 print:hidden">
                  {renderActions(item)}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
