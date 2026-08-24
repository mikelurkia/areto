import type { LucideIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TONE = {
  primary:
    "bg-primary text-primary-foreground shadow-primary/35 hover:shadow-primary/50 focus-visible:ring-primary/40",
  gold: "bg-gold text-gold-foreground shadow-gold/35 hover:shadow-gold/50 focus-visible:ring-gold/40",
} as const;

/**
 * Botón grande de las dos llamadas a la acción del hero. Deliberadamente al
 * margen de la escala de `<Button>` (pensada para la UI densa de la app): aquí
 * el tamaño y la interactividad son el objetivo, no la coherencia con
 * formularios y tablas.
 */
export function HeroCta({
  href,
  tone,
  icon: Icon,
  children,
}: {
  href: string;
  tone: keyof typeof TONE;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-8 py-4 text-lg font-semibold shadow-lg transition-all duration-300 ease-out outline-none hover:-translate-y-1 hover:scale-[1.03] active:translate-y-0 active:scale-100 active:duration-100 focus-visible:ring-4",
        TONE[tone],
      )}
    >
      {/* Brillo diagonal que cruza el botón al pasar el ratón. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-[20deg] bg-white/25 transition-transform duration-700 ease-out group-hover:translate-x-[350%]"
      />
      <span className="relative">{children}</span>
      <Icon className="relative size-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1.5" />
    </Link>
  );
}
