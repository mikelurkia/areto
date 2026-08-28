import type { LucideIcon } from "lucide-react";

import { TONE_VARIANT, type StatusTone } from "@/lib/status-tone";
import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  tone: StatusTone;
  /** Etiqueta ya traducida. */
  label: string;
  icon?: LucideIcon;
  className?: string;
};

/** Badge de estado: el color lo decide el tono, nunca quien la usa. */
export function StatusBadge({ tone, label, icon: Icon, className }: StatusBadgeProps) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className={className}>
      {Icon ? <Icon data-icon="inline-start" /> : null}
      {label}
    </Badge>
  );
}
