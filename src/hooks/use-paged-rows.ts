"use client";

import { useCallback, useState } from "react";

/** Filas por página cuando el listado no pide otra cosa. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Recorta en memoria las filas ya filtradas de un listado.
 *
 * Para los listados que cargan sus datos enteros y filtran en cliente. Los que
 * paginan en servidor (`/personas`, `/socios`) no lo necesitan: allí la página
 * viaja en `?pagina=` y la consulta ya trae solo su tramo.
 *
 * `rows` tiene que venir memoizado (el `useMemo` del filtrado): el reset a la
 * página 1 se decide comparando su identidad, así que un array nuevo en cada
 * render dejaría la paginación clavada en la 1.
 */
export function usePagedRows<T>(rows: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [state, setState] = useState<{ rows: T[]; page: number }>({
    rows,
    page: 1,
  });

  // Cambiar de filtro vuelve a la página 1: filtrar estando en la 3 dejaba la
  // tabla vacía sin decir por qué. Se deriva en el render y no con un efecto,
  // que pintaría un fotograma con la página vieja antes de corregirse.
  const requested = state.rows === rows ? state.page : 1;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // Acotada también por arriba: al filtrar, la última página puede desaparecer.
  const page = Math.min(requested, pageCount);

  const setPage = useCallback(
    (next: number) => setState({ rows, page: next }),
    [rows],
  );

  return {
    page,
    pageCount,
    setPage,
    pageRows: rows.slice((page - 1) * pageSize, page * pageSize),
  };
}
