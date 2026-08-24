import { cn } from "@/lib/utils";

/**
 * Balón de fútbol sala decorativo (silueta + costuras), a juego con
 * `CourtLines`. Puramente decorativo: `aria-hidden` y sin interacción. Pensado
 * para flotar suelto sobre el hero con `animate-float` y un `delay-*`.
 */
export function FutsalBall({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className={cn("text-primary", className)}
    >
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M32 16 L44 25 L39 40 L25 40 L20 25 Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 2 L32 16 M44 25 L57 21 M39 40 L47 51 M25 40 L17 51 M20 25 L7 21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
