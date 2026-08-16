import type { LucideIcon } from "lucide-react";

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
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
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
  children,
}: SectionPlaceholderProps) {
  return (
    <Empty className="flex-1 rounded-lg border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
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
