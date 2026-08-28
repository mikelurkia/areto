import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type SectionPlaceholderProps = {
  /** Solo se pinta en `default`; `compact` no lleva icono. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  /**
   * `default`: el vacío real de una sección — icono, caja punteada y sitio para
   * una acción. `compact`: "sin resultados" dentro de una tarjeta, pestaña o
   * columna estrecha, donde la caja grande desentona: sin icono, sin borde y
   * con menos aire.
   */
  size?: "default" | "compact";
  className?: string;
  /** Acciones reales (botones/diálogos) a mostrar bajo la descripción. */
  children?: React.ReactNode;
};

/**
 * Placeholder de una sección vacía. Puede mostrar acciones reales vía `children`
 * (p.ej. botones de creación) o, si no, un botón deshabilitado con `actionLabel`
 * para secciones aún sin implementar.
 */
export function SectionPlaceholder({
  icon: Icon,
  title,
  description,
  actionLabel,
  size = "default",
  className,
  children,
}: SectionPlaceholderProps) {
  const compact = size === "compact";
  return (
    <Empty
      className={cn(
        compact ? "flex-none gap-2 px-2 py-6" : "flex-1 rounded-lg border border-dashed",
        className,
      )}
    >
      <EmptyHeader className={compact ? "gap-1" : undefined}>
        {compact || !Icon ? null : (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        )}
        <EmptyTitle
          className={
            compact ? "font-sans text-sm font-normal text-muted-foreground" : undefined
          }
        >
          {title}
        </EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? (
        <EmptyContent>{children}</EmptyContent>
      ) : actionLabel ? (
        <EmptyContent>
          <Button disabled>{actionLabel}</Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
