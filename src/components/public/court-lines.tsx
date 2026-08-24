import { cn } from "@/lib/utils";

/**
 * Motivo decorativo con líneas de una cancha de fútbol sala (círculo central,
 * línea de medio campo y arco de esquina) — un guiño discreto al deporte del
 * club. Puramente decorativo: `aria-hidden` y sin interacción.
 */
export function CourtLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      className={cn(
        "pointer-events-none absolute inset-0 size-full text-primary/[0.12]",
        className,
      )}
    >
      <line x1="400" y1="0" x2="400" y2="400" stroke="currentColor" strokeWidth="2" />
      <circle cx="400" cy="200" r="90" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle
        cx="400"
        cy="200"
        r="3"
        fill="currentColor"
        className="animate-pulse-ring origin-[400px_200px]"
      />
      <circle cx="400" cy="200" r="3" fill="currentColor" />
      <path d="M 0 130 A 70 70 0 0 1 70 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M 800 270 A 70 70 0 0 1 730 400" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
