import { createHash } from "node:crypto";

/**
 * Forma común que producen el parser de Norma 43 y el de CSV: de aquí para
 * abajo (huella, inserción) el origen del fichero ya no importa.
 */
export type ParsedMovement = {
  bookedOn: string; // ISO
  valueOn: string | null;
  amountCents: number;
  concept: string;
  counterparty: string | null;
  balanceCents: number | null;
};

export type ParsedImport = {
  movements: ParsedMovement[];
  fromDate: string;
  toDate: string;
};

function normalizeConcept(concept: string): string {
  return concept.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Huella de deduplicación (decisión 5 del plan): hash de cuenta + fecha +
 * importe + concepto normalizado + un `ordinal` que numera, en el orden del
 * fichero, las repeticiones exactas dentro del mismo día — así dos apuntes
 * legítimamente iguales no colapsan en uno, pero reimportar el mismo fichero
 * no duplica nada.
 */
function computeFingerprint(
  accountId: string,
  movement: ParsedMovement,
  ordinal: number,
): string {
  const payload = [
    accountId,
    movement.bookedOn,
    movement.amountCents,
    normalizeConcept(movement.concept),
    ordinal,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export type FingerprintedMovement = ParsedMovement & { fingerprint: string };

export function assignFingerprints(
  accountId: string,
  movements: ParsedMovement[],
): FingerprintedMovement[] {
  const ordinals = new Map<string, number>();
  return movements.map((movement) => {
    const key = `${movement.bookedOn}|${movement.amountCents}|${normalizeConcept(movement.concept)}`;
    const ordinal = ordinals.get(key) ?? 0;
    ordinals.set(key, ordinal + 1);
    return { ...movement, fingerprint: computeFingerprint(accountId, movement, ordinal) };
  });
}
