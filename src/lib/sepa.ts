import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons, sepaCharges, sepaMandates } from "@/db/schema";

export type SequenceType = "FRST" | "RCUR";

/**
 * Reserva el siguiente RUM (Referencia Única de Mandato), de forma atómica y
 * sin huecos, formateado como `RUM000001`. Nunca se deriva de datos mutables
 * (nombre, IBAN): debe sobrevivir a cambios de esos datos y no reutilizarse
 * jamás, ni siquiera si el mandato se revoca.
 */
async function nextRum(): Promise<string> {
  const rows = await db.execute<{ last_number: number }>(sql`
    INSERT INTO sepa_mandate_counter (id, last_number)
    VALUES (1, 1)
    ON CONFLICT (id)
    DO UPDATE SET last_number = sepa_mandate_counter.last_number + 1
    RETURNING last_number
  `);
  const n = Number(rows[0]?.last_number ?? 1);
  return `RUM${String(n).padStart(6, "0")}`;
}

export type PayerCandidate = {
  payerPersonId: string;
  iban: string | null;
  sepaConsent: boolean;
};

/**
 * Mandato activo de una persona pagadora, o `null` si no tiene ninguno. Se usa
 * antes de generar cargos, para decidir `sequenceType` (FRST/RCUR) y para no
 * crear un mandato duplicado.
 */
export async function findActiveMandate(payerPersonId: string) {
  return db.query.sepaMandates.findFirst({
    where: and(eq(sepaMandates.payerPersonId, payerPersonId), eq(sepaMandates.status, "active")),
  });
}

/**
 * Obtiene el mandato activo de la persona pagadora, o lo crea de forma
 * perezosa si aún no existe. Requiere `iban` + `sepaConsent=true`: quien llama
 * debe comprobar esas dos condiciones antes (y omitir el cargo si faltan) —
 * esta función no las repite porque el "omitido" es una decisión de la
 * generación de cargos, no del mandato en sí.
 */
export async function getOrCreateMandate(payer: PayerCandidate) {
  const existing = await findActiveMandate(payer.payerPersonId);
  if (existing) return existing;

  const rum = await nextRum();
  const today = new Date().toISOString().slice(0, 10);
  const [created] = await db
    .insert(sepaMandates)
    .values({
      payerPersonId: payer.payerPersonId,
      rum,
      signedOn: today,
      ibanSnapshot: payer.iban as string,
    })
    .returning();
  return created;
}

/** `FRST` si el mandato nunca ha cobrado un cargo, `RCUR` en caso contrario. */
export async function nextSequenceType(mandateId: string): Promise<SequenceType> {
  const priorCharge = await db.query.sepaCharges.findFirst({
    where: eq(sepaCharges.mandateId, mandateId),
    columns: { id: true },
  });
  return priorCharge ? "RCUR" : "FRST";
}

/**
 * Revoca el mandato activo de una persona (acción explícita desde la ficha):
 * marca el mandato como `revoked` y retira el consentimiento SEPA de la
 * propia persona. Un mandato revocado nunca se reutiliza.
 */
export async function revokeMandate(payerPersonId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(sepaMandates)
    .set({ status: "revoked", revokedOn: today })
    .where(and(eq(sepaMandates.payerPersonId, payerPersonId), eq(sepaMandates.status, "active")));
  await db.update(persons).set({ sepaConsent: false }).where(eq(persons.id, payerPersonId));
}
