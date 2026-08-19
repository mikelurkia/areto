const IBAN_STRUCTURE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/** Longitud máxima de un IBAN según ISO 13616 (2 letras de país + 2 dígitos
 * de control + hasta 30 caracteres de BBAN). */
const IBAN_MAX_LENGTH = 34;

/** Grupos del formato de visualización/tecleo pedido por el club:
 * "XXXX XXXX XXXX XX XXXXXXXXXX" (prefijo IBAN de 4 + el CCC español
 * entidad-oficina-DC-cuenta). Cubre los 24 caracteres de un IBAN español;
 * lo que sobre de un IBAN extranjero más largo se añade sin trocear más. */
const IBAN_DISPLAY_GROUPS = [4, 4, 4, 2, 10];

/** Inserta los espacios del formato sobre un valor ya limpio (sin espacios) —
 * exportada aparte de `formatIbanInput` porque `MaskedIbanText` la aplica
 * sobre una cadena con los dígitos ya sustituidos por "•", que
 * `formatIbanInput` borraría al no ser alfanumérica. */
export function groupIban(value: string): string {
  const parts: string[] = [];
  let index = 0;
  for (const size of IBAN_DISPLAY_GROUPS) {
    if (index >= value.length) break;
    parts.push(value.slice(index, index + size));
    index += size;
  }
  if (index < value.length) parts.push(value.slice(index));
  return parts.join(" ");
}

/** Aplica el formato "XXXX XXXX XXXX XX XXXXXXXXXX" a un valor tal cual se
 * teclea: quita todo lo que no sea alfanumérico, pone en mayúsculas y
 * reagrupa. Pensada para usarse en cada `onChange` de un campo de IBAN. */
export function formatIbanInput(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, IBAN_MAX_LENGTH);
  return groupIban(clean);
}

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
