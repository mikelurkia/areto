/**
 * Valida un código postal español: cinco dígitos cuyos dos primeros son el
 * código de provincia (01-52).
 *
 * Mismo criterio permisivo que `isValidNationalId`: si el valor no tiene forma
 * de CP español (una dirección extranjera, p. ej. "SW1A 1AA") no lo rechaza,
 * solo comprueba el rango de provincia cuando ya se ve que se quiso escribir
 * uno de aquí. Así se cazan las erratas de tecleo — "25060" en vez de
 * "20560" pasa, pero "75560" o "2056" no — sin bloquear a nadie.
 */
export function isValidPostalCode(raw: string): boolean {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return true;
  if (value.length !== 5) return false;
  const province = Number(value.slice(0, 2));
  return province >= 1 && province <= 52;
}
