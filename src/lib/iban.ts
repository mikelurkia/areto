const IBAN_STRUCTURE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/**
 * Valida estructura + dígito de control (ISO 7064 MOD 97-10). A diferencia de
 * `isValidNationalId`, aquí no hay "formato alternativo legítimo": toda
 * domiciliación SEPA exige un IBAN real, así que un valor no vacío que no
 * supere el control se considera inválido. No exige un país concreto
 * (cualquiera del área SEPA vale), solo estructura ISO 13616 y checksum.
 */
export function isValidIban(raw: string): boolean {
  const value = raw.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_STRUCTURE.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return BigInt(numeric) % BigInt(97) === BigInt(1);
}
