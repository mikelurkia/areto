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

/**
 * Color de un icono suelto por tono, para cuando el estado no viste un badge
 * sino un icono a secas —la columna de avisos del listado de personas—. Mismo
 * criterio que `ui/alert.tsx`, donde el color va en el icono y no en el texto.
 */
export const TONE_ICON: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  highlight: "text-gold",
};
