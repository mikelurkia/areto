/**
 * Código de entidad español (4 dígitos tras el país+control de un IBAN `ES`,
 * herencia del antiguo CCC) → nombre del banco. No es una lista exhaustiva del
 * registro del Banco de España, solo las entidades más habituales; un código
 * ausente simplemente no muestra banco (no se considera un error).
 */
const SPANISH_BANK_ENTITY_CODES: Record<string, string> = {
  "0019": "Deutsche Bank",
  "0049": "Banco Santander",
  "0061": "Banca March",
  "0073": "Openbank",
  "0075": "Banco Popular Español",
  "0081": "Banco Sabadell",
  "0128": "Bankinter",
  "0182": "BBVA",
  "0239": "Evo Banco",
  "1465": "ING",
  "2038": "Bankia (CaixaBank)",
  "2048": "Unicaja Banco",
  "2080": "Abanca",
  "2085": "Ibercaja Banco",
  "2095": "Kutxabank",
  "2100": "CaixaBank",
  "2103": "Unicaja Banco",
  "3008": "Caja Rural (Rural Kutxa)",
  "3025": "Caja Rural del Sur",
  "3035": "Laboral Kutxa",
  "3058": "Cajamar Caja Rural",
};

const IBAN_STRUCTURE = /^ES\d{2}\d{20}$/;

/**
 * Deduce el nombre del banco a partir del código de entidad de un IBAN
 * español (posiciones 5-8). Solo reconoce IBANes `ES`; para cualquier otro
 * país, o si el código de entidad no está en la tabla, devuelve `null`.
 */
export function getBankName(iban: string | null | undefined): string | null {
  if (!iban) return null;
  const value = iban.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_STRUCTURE.test(value)) return null;
  const entityCode = value.slice(4, 8);
  return SPANISH_BANK_ENTITY_CODES[entityCode] ?? null;
}
