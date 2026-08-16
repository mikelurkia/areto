"use client";

import { useState } from "react";

/**
 * Congela `value` mientras el diálogo está abierto (incluida la animación de
 * cierre) y solo la vuelve a leer al abrir. Sin esto, cuando una Server Action
 * revalida datos justo al cerrarse el diálogo, el `defaultValue` de un input
 * no controlado cambia mientras el diálogo todavía está montado (animando su
 * cierre), y Base UI avisa de "uncontrolled FieldControl" en consola.
 */
export function useFrozenWhileOpen<T>(open: boolean, value: T): T {
  const [prevOpen, setPrevOpen] = useState(open);
  const [frozen, setFrozen] = useState(value);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setFrozen(value);
  }
  return frozen;
}
