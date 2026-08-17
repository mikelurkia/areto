import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

/** En el servidor no hay viewport: se asume escritorio y React corrige al hidratar. */
function getServerSnapshot() {
  return false
}

/**
 * `matchMedia` es un sistema externo, así que se lee con `useSyncExternalStore`
 * en vez de copiarlo a un `useState` desde un efecto: leer el ancho en el render
 * evita el segundo render en cascada y deja que React use el valor del servidor
 * durante la hidratación, sin desajuste.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
