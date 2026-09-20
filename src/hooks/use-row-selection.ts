"use client";

import { useState } from "react";

/**
 * Selección de filas para acciones en bloque, compartida entre listados
 * paginados en servidor. La selección sobrevive al cambio de página: solo
 * "seleccionar todo" (y por tanto `allPageSelected`) mira las filas de la
 * página actual.
 */
export function useRowSelection<T extends { id: string }>(rows: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => (checked ? next.add(row.id) : next.delete(row.id)));
      return next;
    });
  }

  return { selectedIds, setSelectedIds, allPageSelected, toggleSelected, toggleSelectAll };
}
