"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/** Parámetro de la URL que indica qué diálogo está abierto. */
const DIALOG_PARAM = "dialogo";

/**
 * Estado de apertura de un diálogo derivado de la URL, en lugar de `useState`.
 *
 * Con Cache Components activo React conserva las pantallas montadas
 * (`<Activity>`) al navegar: un `useState` haría que un diálogo abierto siguiera
 * abierto al volver, y que los efectos que dependen de "se acaba de abrir" no
 * se dispararan (abrir pone `true` sobre `true`, que no es un cambio). Derivarlo
 * de la URL lo arregla de raíz: al navegar, la URL cambia y el diálogo se cierra.
 * Es la recomendación de la guía "Preserving UI state" de Next.
 *
 * Un único parámetro con el `key` como valor, así que solo hay un diálogo abierto
 * a la vez, que es lo que permite la UI. `key` debe identificar la instancia:
 * en una tabla hay un diálogo de borrado por fila, y todos comparten componente.
 *
 * Se actualiza con la History API nativa —integrada en el router de Next, que
 * sincroniza `useSearchParams`— y no con `router.push`: abrir un diálogo no debe
 * provocar una petición al servidor ni recargar los datos de la pantalla.
 * `pushState` al abrir, para que el botón "atrás" cierre el diálogo, y
 * `replaceState` al cerrar, para no dejar una entrada que lo reabra.
 */
export function useDialogParam(key: string): [boolean, (open: boolean) => void] {
  const searchParams = useSearchParams();
  const open = searchParams.get(DIALOG_PARAM) === key;

  const setOpen = useCallback(
    (next: boolean) => {
      // Se lee de `window.location` y no del hook para no capturar un valor
      // viejo: los demás parámetros de la pantalla (p. ej. `?season=`) se conservan.
      const params = new URLSearchParams(window.location.search);
      if (next) params.set(DIALOG_PARAM, key);
      else params.delete(DIALOG_PARAM);

      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
      if (next) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [key],
  );

  return [open, setOpen];
}
