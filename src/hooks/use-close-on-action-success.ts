"use client";

import { useState } from "react";

/**
 * Cierra un Dialog cuando una Server Action (useActionState) tiene éxito.
 * Compara la identidad del objeto `state` (no el texto del mensaje) para
 * detectar "llegó un resultado nuevo" sin depender de un useEffect —
 * `state` cambia de referencia en cada acción aunque el mensaje se repita.
 */
export function useCloseOnActionSuccess(
  state: { message?: string },
  setOpen: (open: boolean) => void,
) {
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.message) setOpen(false);
  }
}
