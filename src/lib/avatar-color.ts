/**
 * Color determinista para el fallback de un avatar: mismo `seed` (el id de la
 * persona, estable frente a cambios de nombre) siempre da el mismo color, para
 * reconocer a alguien de un vistazo en listas largas.
 *
 * Reutiliza los tokens `chart-1`..`chart-5` (ya theme-aware en claro/oscuro)
 * en vez de introducir color nuevo.
 */

const TONE_CLASSES = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

export function avatarToneClasses(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % TONE_CLASSES.length;
  return TONE_CLASSES[index];
}
