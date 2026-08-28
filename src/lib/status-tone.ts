/**
 * Tono semántico de un estado, independiente del dominio. Cada módulo mapea sus
 * propios estados a un tono (`registration-status.ts`, `sponsorship.ts`, …) y el
 * color sale de aquí, para que "aprobado" y "vigente" se pinten igual en toda
 * la aplicación.
 */
export type StatusTone = "neutral" | "positive" | "warning" | "danger" | "highlight";

/** Variante de `Badge` por tono. Único sitio donde un estado elige color. */
export const TONE_VARIANT: Record<StatusTone, "outline" | "success" | "warning" | "destructive" | "gold"> = {
  neutral: "outline",
  positive: "success",
  warning: "warning",
  danger: "destructive",
  highlight: "gold",
};
