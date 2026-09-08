import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Anterior/siguiente entre las inscripciones pendientes (mismo orden que el
 * listado, por fecha de envío descendente), para revisarlas en lote sin
 * volver atrás a la lista cada vez — típico en el arranque de temporada.
 */
export async function RegistrationPendingNav({
  prevId,
  nextId,
  position,
  total,
}: {
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
}) {
  const t = await getTranslations("Inscripciones");

  return (
    <div className="flex items-center gap-2">
      {prevId ? (
        <Link
          href={`/inscripciones/${prevId}`}
          aria-label={t("pendingNavPrevAriaLabel")}
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
        >
          <ChevronLeftIcon />
        </Link>
      ) : (
        <span
          aria-hidden
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "opacity-40")}
        >
          <ChevronLeftIcon />
        </span>
      )}
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {t("pendingNavPosition", { position, total })}
      </span>
      {nextId ? (
        <Link
          href={`/inscripciones/${nextId}`}
          aria-label={t("pendingNavNextAriaLabel")}
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
        >
          <ChevronRightIcon />
        </Link>
      ) : (
        <span
          aria-hidden
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "opacity-40")}
        >
          <ChevronRightIcon />
        </span>
      )}
    </div>
  );
}
