/** Fecha de un consentimiento que se acaba de conceder por primera vez (p. ej.
 * al enviar un formulario): `null` si no se concedió. */
export function stampConsent(granted: boolean): Date | null {
  return granted ? new Date() : null;
}

/**
 * Próxima fecha de un consentimiento tras una edición manual. Solo se sella
 * una fecha nueva al pasar de no concedido a concedido; al revocarlo se
 * pierde la fecha anterior a propósito (solo debe constar el consentimiento
 * *vigente*), y si no cambia se conserva la fecha ya registrada.
 */
export function nextConsentAt(
  wasGranted: boolean,
  isGranted: boolean,
  previousAt: Date | null,
): Date | null {
  if (!isGranted) return null;
  if (!wasGranted) return new Date();
  return previousAt;
}
