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
 * evita el segundo render en cascada, y React usa `getServerSnapshot` en la
 * pasada de hidratación, de modo que arranca con el mismo valor que el servidor.
 *
 * Ojo: eso solo cubre la pasada de hidratación de cada árbol. Quien decida entre
 * dos marcados distintos según este valor tiene que hidratar a la vez que el
 * componente que lo publica; si queda dentro de un <Suspense> que llega más
 * tarde, el valor ya habrá cambiado y no coincidirá con el HTML del servidor.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
