"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Ejecuta `onResult` una sola vez por cada resultado nuevo de una Server Action
 * (useActionState).
 *
 * Se compara la identidad del objeto de estado, no su contenido: con Cache
 * Components activo React conserva las rutas montadas (`<Activity>`) y vuelve a
 * crear los efectos al regresar a una pantalla, así que un efecto que dependiera
 * del mensaje o del error repetiría su acción en cada vuelta —un toast que
 * reaparece, un formulario que se vacía—. La `ref` sobrevive a ese ocultar y
 * mostrar, y `state` cambia de referencia en cada acción aunque el texto se
 * repita, así que dos guardados seguidos con el mismo mensaje sí avisan dos veces.
 */
export function useActionResult<S extends object>(
  state: S,
  onResult: (state: S) => void,
) {
  const handled = useRef(state);

  useEffect(() => {
    // El guardia hace inocuas las re-ejecuciones: da igual que el efecto vuelva
    // a correr porque `onResult` cambie de identidad o porque React muestre otra
    // vez la pantalla; solo actúa cuando el estado es nuevo de verdad.
    if (handled.current === state) return;
    handled.current = state;
    onResult(state);
  }, [state, onResult]);
}

/** Muestra un toast de éxito por cada mensaje nuevo de una Server Action. */
export function useActionToast(state: { message?: string }) {
  useActionResult(state, (result) => {
    if (result.message) toast.success(result.message);
  });
}
