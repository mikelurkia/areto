"use client";

import { useTranslations } from "next-intl";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

/** Páginas que se pintan a cada lado de la actual antes de poner los puntos. */
const AROUND_CURRENT = 1;

/**
 * Páginas a pintar: la primera, la última, la actual con sus vecinas, y puntos
 * en los huecos. Sin esto un listado de 40 páginas pintaba 40 botones.
 */
export function pageWindow(
  page: number,
  pageCount: number,
): (number | "ellipsis")[] {
  const shown = new Set<number>([1, pageCount]);
  for (let p = page - AROUND_CURRENT; p <= page + AROUND_CURRENT; p += 1) {
    if (p >= 1 && p <= pageCount) shown.add(p);
  }

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const p of [...shown].sort((a, b) => a - b)) {
    // Un hueco de una sola página no merece puntos: cabe el número.
    if (p - previous === 2) result.push(p - 1);
    else if (p - previous > 2) result.push("ellipsis");
    result.push(p);
    previous = p;
  }
  return result;
}

type PaginationBarProps = {
  page: number;
  pageCount: number;
  /** Se llama con la página pedida, ya acotada a `[1, pageCount]`. */
  onPageChange: (page: number) => void;
  /**
   * URL de cada página, para los listados que paginan en servidor: el enlace
   * es real y se puede abrir en otra pestaña, pero el clic normal lo sigue
   * atendiendo `onPageChange` (que reemplaza en el historial en vez de apilar
   * una entrada por página).
   */
  hrefFor?: (page: number) => string;
  className?: string;
};

/**
 * Barra de paginación única de la aplicación, con la misma mecánica para los
 * listados que paginan en servidor (`/personas`, `/socios`) y para los que
 * recortan en memoria con [`usePagedRows`](../hooks/use-paged-rows.ts).
 *
 * No pinta nada si solo hay una página: los listados cortos no llevan cromo.
 * Se esconde al imprimir, como el resto de controles.
 */
export function PaginationBar({
  page,
  pageCount,
  onPageChange,
  hrefFor,
  className,
}: PaginationBarProps) {
  const t = useTranslations("Pagination");

  if (pageCount <= 1) return null;

  function go(event: React.MouseEvent, next: number) {
    event.preventDefault();
    const target = Math.min(Math.max(1, next), pageCount);
    if (target !== page) onPageChange(target);
  }

  const href = (target: number) => hrefFor?.(target) ?? "#";
  const disabled = "pointer-events-none opacity-50";

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={t("previous")}
            aria-label={t("previous")}
            href={href(page - 1)}
            onClick={(e) => go(e, page - 1)}
            className={page === 1 ? disabled : undefined}
          />
        </PaginationItem>

        {pageWindow(page, pageCount).map((entry, i) =>
          entry === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink
                href={href(entry)}
                isActive={entry === page}
                aria-label={t("page", { page: entry })}
                onClick={(e) => go(e, entry)}
              >
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            text={t("next")}
            aria-label={t("next")}
            href={href(page + 1)}
            onClick={(e) => go(e, page + 1)}
            className={page === pageCount ? disabled : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
