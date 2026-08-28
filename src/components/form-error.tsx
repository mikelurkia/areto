/**
 * El error de una Server Action, con la misma forma en todos los formularios.
 *
 * No lleva margen propio a propósito: el espaciado lo pone el `flex flex-col
 * gap-*` del contenedor. Es lo que evita que cada diálogo elija el suyo
 * (`mb-3` en unos, nada en otros), que era la divergencia que había.
 */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" aria-live="polite" className="text-sm text-destructive">
      {message}
    </p>
  );
}
