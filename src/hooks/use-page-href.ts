"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * URL de una página del listado, para que el enlace se pueda abrir en otra
 * pestaña (el clic lo atiende un `goToPage` propio que reemplaza en el
 * historial en vez de navegar).
 */
export function usePageHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return function hrefForPage(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page === 1) params.delete("pagina");
    else params.set("pagina", String(page));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  };
}
