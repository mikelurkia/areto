import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons, sepaCharges, sepaMandates } from "@/db/schema";

export type SequenceType = "FRST" | "RCUR";

/**
 * Reserva `count` RUMs (Referencia Única de Mandato) consecutivos, de forma
 * atómica y sin huecos, formateados como `RUM000001`. Nunca se derivan de
 * datos mutables (nombre, IBAN): deben sobrevivir a cambios de esos datos y no
 * reutilizarse jamás, ni siquiera si el mandato se revoca.
 *
 * La reserva es de un lote entero y no de uno en uno porque una tanda de
 * cargos puede estrenar varios pagadores a la vez; el `RETURNING` devuelve el
 * último número del tramo, así que el tramo reservado es
 * `[last - count + 1, last]`.
 */
async function reserveRums(count: number): Promise<string[]> {
  const rows = await db.execute<{ last_number: number }>(sql`
    INSERT INTO sepa_mandate_counter (id, last_number)
    VALUES (1, ${count})
    ON CONFLICT (id)
    DO UPDATE SET last_number = sepa_mandate_counter.last_number + ${count}
    RETURNING last_number
  `);
  const last = Number(rows[0]?.last_number ?? count);
  const first = last - count + 1;
  return Array.from({ length: count }, (_, i) => `RUM${String(first + i).padStart(6, "0")}`);
}

export type PayerCandidate = {
  payerPersonId: string;
  iban: string | null;
  sepaConsent: boolean;
};

export type ResolvedMandate = {
  id: string;
  /** ¿Este mandato ya había cobrado algún cargo antes de esta tanda? */
  hasPriorCharge: boolean;
};

/**
 * Resuelve de una sola tanda el mandato de cada pagador —creando los que
 * falten— junto con si ya había cobrado algo antes.
 *
 * Requiere `iban` + `sepaConsent=true` en cada candidato: quien llama debe
 * comprobar esas dos condiciones antes y omitir al pagador si faltan, porque
 * el "omitido" es una decisión de la generación de cargos, no del mandato.
 *
 * Sustituye al par `getOrCreateMandate` + `nextSequenceType` que se llamaba
 * **por cargo** dentro del bucle de generación: para un equipo mensual eran
 * dos consultas por jugador y mes, cientos por invocación. Aquí son tres
 * consultas para la tanda entera, sea cual sea su tamaño.
 *
 * Y, sobre todo, `nextSequenceType` preguntaba a la base de datos una vez por
 * fila cuando todavía no se había insertado ninguna, así que **todas** las de
 * un pagador estrenado salían `FRST`. Un mandato SEPA admite un único `FRST` y
 * el banco rechaza los demás. Por eso aquí solo se informa del estado previo:
 * repartir `FRST`/`RCUR` dentro de la tanda es cosa de `sequenceTypeAssigner`.
 */
export async function resolveMandates(
  payers: PayerCandidate[],
): Promise<Map<string, ResolvedMandate>> {
  const ibanByPayerId = new Map(payers.map((p) => [p.payerPersonId, p.iban]));
  const payerIds = [...ibanByPayerId.keys()];
  if (payerIds.length === 0) return new Map();

  const active = await db.query.sepaMandates.findMany({
    where: and(
      inArray(sepaMandates.payerPersonId, payerIds),
      eq(sepaMandates.status, "active"),
    ),
    columns: { id: true, payerPersonId: true },
  });
  const mandateIdByPayerId = new Map(active.map((m) => [m.payerPersonId, m.id]));

  const missing = payerIds.filter((id) => !mandateIdByPayerId.has(id));
  if (missing.length > 0) {
    const rums = await reserveRums(missing.length);
    const signedOn = new Date().toISOString().slice(0, 10);
    const created = await db
      .insert(sepaMandates)
      .values(
        missing.map((payerPersonId, i) => ({
          payerPersonId,
          rum: rums[i],
          signedOn,
          ibanSnapshot: ibanByPayerId.get(payerPersonId) as string,
        })),
      )
      .returning({ id: sepaMandates.id, payerPersonId: sepaMandates.payerPersonId });
    for (const m of created) mandateIdByPayerId.set(m.payerPersonId, m.id);
  }

  /*
   * Solo se pregunta por los mandatos que ya existían: uno recién creado no
   * puede tener cargos, y preguntar por él sería una fila que nunca casa.
   */
  const priorCharges = new Set<string>();
  if (active.length > 0) {
    const charged = await db
      .selectDistinct({ mandateId: sepaCharges.mandateId })
      .from(sepaCharges)
      .where(
        inArray(
          sepaCharges.mandateId,
          active.map((m) => m.id),
        ),
      );
    for (const row of charged) priorCharges.add(row.mandateId);
  }

  return new Map(
    [...mandateIdByPayerId].map(([payerPersonId, id]) => [
      payerPersonId,
      { id, hasPriorCharge: priorCharges.has(id) },
    ]),
  );
}

/**
 * Reparte `FRST`/`RCUR` dentro de una misma tanda de cargos: el primero de
 * cada mandato que aún no había cobrado nada es su `FRST`, y todo lo demás
 * `RCUR`. Lleva estado, así que se crea uno por tanda.
 *
 * Sin esto, generar de golpe los diez meses de un jugador nuevo produce diez
 * `FRST` del mismo mandato y el banco rechaza nueve.
 */
export function sequenceTypeAssigner(): (mandate: ResolvedMandate) => SequenceType {
  const started = new Set<string>();
  return (mandate) => {
    if (mandate.hasPriorCharge || started.has(mandate.id)) return "RCUR";
    started.add(mandate.id);
    return "FRST";
  };
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
