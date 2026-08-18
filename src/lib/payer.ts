/**
 * Un menor no puede ser titular de un mandato SEPA: si hay tutores, el
 * principal (el primero de la lista) es quien paga y la persona solo queda
 * enlazada a él vía `payerPersonId`, sin iban ni consentimiento SEPA propios.
 */
export function resolvePayerFields(
  guardianIds: readonly string[],
  iban: string | null,
  sepaConsent: boolean,
): { payerPersonId: string | null; iban: string | null; sepaConsent: boolean } {
  const payerPersonId = guardianIds[0] ?? null;
  return {
    payerPersonId,
    iban: payerPersonId ? null : iban,
    sepaConsent: payerPersonId ? false : sepaConsent,
  };
}
