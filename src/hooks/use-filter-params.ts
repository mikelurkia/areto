"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
 *
 * `navigate: true` para los listados que YA resuelven sus filtros en el
 * servidor (`/personas`): ahí el cambio de filtro sí tiene que llegar al
 * servidor, así que se escribe con el router en vez de con la History API. El
 * resto de listados sigue filtrando en memoria y no debe provocar petición
 * alguna, que es lo que este hook evitaba deliberadamente.
 *
 * El tercer elemento de la tupla dice si ese viaje está en vuelo. Solo tiene
 * sentido con `navigate: true`: en los demás la escritura es síncrona y no hay
 * nada que esperar, así que sale siempre `false`. Sin él, entre teclear y ver
 * filas nuevas quedaba la tabla anterior quieta en pantalla sin señal alguna.
 */
export function useFilterParams<T extends Record<string, string>>(
  defaults: T,
  options?: { navigate?: boolean },
): [T, (patch: Partial<T>) => void, boolean] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const navigate = options?.navigate ?? false;
  const [isPending, startTransition] = useTransition();

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
      const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
      // `replace` y no `push` por el mismo motivo que `replaceState`: un filtro
      // por pulsación no debe dejar una entrada de historial por tecla.
      // Dentro de una transición para poder decir que el listado se está
      // recargando; el `replaceState` no la necesita porque no espera a nadie.
      if (navigate) startTransition(() => router.replace(url, { scroll: false }));
      else window.history.replaceState(null, "", url);
    },
    [defaults, navigate, router],
  );

  return [values, setFilters, isPending];
}

/**
 * ¿Hay algún filtro puesto? Equivalente en cliente de `hasActiveFilters` de
 * `person-list.ts`, que responde a lo mismo en servidor para distinguir "el
 * club no tiene personas" de "esta búsqueda no devuelve nada". Aquí sirve para
 * lo otro: enseñar «limpiar filtros» solo cuando hay algo que limpiar.
 *
 * `pagina` no cuenta: estar en la página 3 no es un filtro, y ofrecer
 * "limpiar" por haber pasado de página sería ruido.
 */
export function hasActiveFilters<T extends Record<string, string>>(
  values: T,
  defaults: T,
  ignore: readonly (keyof T)[] = ["pagina" as keyof T],
): boolean {
  return Object.keys(defaults).some(
    (key) => !ignore.includes(key) && values[key] !== defaults[key],
  );
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
