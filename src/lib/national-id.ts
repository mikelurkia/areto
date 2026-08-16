const CHECK_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const NIE_PREFIX_DIGIT: Record<string, string> = { X: "0", Y: "1", Z: "2" };

/**
 * Valida la letra de control de un DNI/NIE español.
 * Si el valor no tiene forma de DNI/NIE (p.ej. un pasaporte extranjero), no lo
 * rechaza: el campo admite cualquier documento, solo comprobamos el dígito de
 * control cuando el formato sugiere que se quiso escribir un DNI/NIE, para
 * detectar erratas de tecleo sin bloquear identificaciones extranjeras.
 */
export function isValidNationalId(raw: string): boolean {
  const value = raw.trim().toUpperCase();

  const dniMatch = /^(\d{8})([A-Z])$/.exec(value);
  if (dniMatch) {
    const [, digits, letter] = dniMatch;
    return CHECK_LETTERS[Number(digits) % 23] === letter;
  }

  const nieMatch = /^([XYZ])(\d{7})([A-Z])$/.exec(value);
  if (nieMatch) {
    const [, prefix, digits, letter] = nieMatch;
    const number = Number(NIE_PREFIX_DIGIT[prefix] + digits);
    return CHECK_LETTERS[number % 23] === letter;
  }

  return true;
}
