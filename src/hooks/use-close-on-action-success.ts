"use client";

import { useActionResult } from "@/hooks/use-action-toast";

/**
 * Cierra un Dialog cuando una Server Action (useActionState) tiene éxito.
 *
 * Va en un efecto, no en el render: `setOpen` viene de `useDialogParam` y
 * escribe en el historial del navegador, así que es un efecto secundario y no
 * puede ejecutarse mientras React renderiza.
 *
 * `useActionResult` compara la identidad del objeto `state` —que cambia en cada
 * acción aunque el mensaje se repita— así que cierra una sola vez por resultado
 * nuevo y no vuelve a dispararse cuando React muestra de nuevo la pantalla.
 */
export function useCloseOnActionSuccess(
  state: { message?: string },
  setOpen: (open: boolean) => void,
) {
  useActionResult(state, (result) => {
    if (result.message) setOpen(false);
  });
}
