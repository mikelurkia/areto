"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Pestaña activa derivada de la URL, en lugar de `useState`.
 *
 * Mismo motivo que en `use-dialog-param`: con Cache Components React conserva
 * las pantallas montadas (`<Activity>`) al navegar, así que un `useState` se
 * quedaría con la pestaña elegida la vez anterior. Derivarlo de la URL además
 * hace que recargar o compartir el enlace lleve a la misma pestaña.
 *
 * Se escribe con `replaceState` y no con `pushState`: cambiar de pestaña no
 * debería llenar el historial de entradas por las que hay que pasar al volver
 * atrás. Y con la History API nativa, no con `router.push`, para no provocar
 * una petición al servidor.
 */
export function useTabParam<T extends string>(
  param: string,
  values: readonly T[],
): [T, (next: T) => void] {
  const searchParams = useSearchParams();
  const raw = searchParams.get(param);
  const current = values.includes(raw as T) ? (raw as T) : values[0];

  const setTab = useCallback(
    (next: T) => {
      // Desde `window.location` y no desde el hook, para conservar el resto de
      // parámetros de la pantalla tal y como estén ahora mismo.
      const params = new URLSearchParams(window.location.search);
      if (next === values[0]) params.delete(param);
      else params.set(param, next);

      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    },
    // `values` se declara en línea en cada uso; solo importa su primer elemento.
    [param, values],
  );

  return [current, setTab];
}
