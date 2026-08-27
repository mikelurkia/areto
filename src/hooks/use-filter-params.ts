"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Filtros de un listado guardados en la URL en vez de en `useState`.
 *
 * Los listados de la aplicación cargan sus datos enteros y filtran en cliente,
 * así que hasta ahora el filtro se perdía al recargar, al volver de una ficha o
 * al pasar el enlace a alguien. Con los valores en la URL, "las personas del
 * Cadete A sin reconocimiento" es algo que se puede guardar en marcadores y
 * mandar por correo.
 *
 * Se escribe con la History API nativa —integrada en el router de Next, que
 * sincroniza `useSearchParams`— y no con `router.push`: cambiar un filtro no
 * debe provocar una petición al servidor. Y con `replaceState`, para no dejar
 * una entrada de historial por cada tecla.
 *
 * `defaults` define a la vez los parámetros que se leen, sus valores de partida
 * y cuáles se omiten de la URL (los que están en su valor por defecto, para que
 * el enlace no se llene de `?estado=all`). Decláralo fuera del componente: si se
 * crea en cada render, los valores se recalculan también en cada render.
 */
export function useFilterParams<T extends Record<string, string>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const searchParams = useSearchParams();

  const values = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [
          key,
          searchParams.get(key) ?? fallback,
        ]),
      ) as T,
    [searchParams, defaults],
  );

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      // Desde `window.location` y no desde el hook, para conservar el resto de
      // parámetros de la pantalla (`?dialogo=`, `?from=`…) tal y como estén.
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (value === defaults[key]) params.delete(key);
        else params.set(key, value);
      }

      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    },
    [defaults],
  );

  return [values, setFilters];
}

/** Margen entre la última tecla y la escritura en la URL. */
const COMMIT_DELAY_MS = 300;

/**
 * Texto de un buscador: inmediato en pantalla, con retraso en la URL.
 *
 * El valor que se devuelve es local, así que la lista se filtra según se
 * teclea, igual que antes. Lo que se aplaza es solo dejarlo escrito en la URL:
 * escribir una entrada de historial por pulsación no aporta nada y hace trabajar
 * al router en cada tecla.
 *
 * Solo lee `initial` al montar. Es deliberado: mientras el buscador está en
 * pantalla, quien manda es lo que teclea el usuario.
 */
export function useSearchText(
  initial: string,
  commit: (value: string) => void,
): [string, (value: string) => void] {
  const [text, setText] = useState(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Por referencia: así el callback de abajo no cambia de identidad porque
  // quien lo usa haya vuelto a crear la función de guardado.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const update = useCallback((value: string) => {
    setText(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commitRef.current(value), COMMIT_DELAY_MS);
  }, []);

  return [text, update];
}
