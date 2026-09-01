"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  clubMembers,
  memberships,
  persons,
  sepaCharges,
  sepaChargeReturns,
  sepaRemittances,
} from "@/db/schema";
import { recordAuditEvent } from "@/lib/audit-log";
import { requirePermission } from "@/lib/auth";
import { buildPain008, type SepaChargeForXml } from "@/lib/sepa-xml";
import { resolveMandates, sequenceTypeAssigner } from "@/lib/sepa";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type CuotasState = {
  error?: string;
  message?: string;
};

/** `["2026-09", "2026-10", ...]` entre dos fechas ISO, ambas inclusive. */
function monthlyPeriodKeys(startsOn: string, endsOn: string): string[] {
  const [startYear, startMonth] = startsOn.split("-").map(Number);
  const [endYear, endMonth] = endsOn.split("-").map(Number);
  const keys: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

type PersonPayerFields = {
  id: string;
  payerPersonId: string | null;
};

/** Lo único que hace falta de la persona para saber quién paga por ella. */
const PAYER_COLUMNS = { id: true, payerPersonId: true } as const;

/** Persona pagadora efectiva: el tutor enlazado si lo hay, o la propia persona. */
function payerIdOf(person: PersonPayerFields): string {
  return person.payerPersonId ?? person.id;
}

type PayerRow = { id: string; iban: string | null; sepaConsent: boolean };

/**
 * Los pagadores que de verdad van a recibir un cargo en esta tanda, sin
 * repetir: los que no tienen IBAN o consentimiento quedan fuera porque el
 * bucle los cuenta como omitidos.
 *
 * No vale con pasar todos los pagadores del equipo: `resolveMandates` crea el
 * mandato que falte, y estrenarle uno a quien no se le va a cobrar nada gasta
 * un RUM —que no se reutiliza jamás— para nada.
 */
function payersToCharge(payerIds: string[], payerById: Map<string, PayerRow>) {
  return [...new Set(payerIds)].flatMap((id) => {
    const payer = payerById.get(id);
    if (!payer?.iban || !payer.sepaConsent) return [];
    return [{ payerPersonId: payer.id, iban: payer.iban, sepaConsent: payer.sepaConsent }];
  });
}

async function nextRemittanceMessageId(): Promise<string> {
  const rows = await db.execute<{ count: number }>(sql`select count(*)::int as count from sepa_remittances`);
  const n = Number(rows[0]?.count ?? 0) + 1;
  return `ARETO-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
}

/**
 * Genera los cargos `pending` que falten para un equipo/temporada: uno por
 * jugador (la exención de plantilla es, literalmente, filtrar por
 * `role = "player"`) y por cada `periodKey` que corresponda (uno si la cuota
 * es de temporada/puntual, uno por mes si es mensual, uno o dos —
 * `periodKey` `"1"`/`"2"`, al 50%— si es en plazos, según el
 * `installmentsCount` de cada membership). Idempotente: solo inserta las
 * combinaciones que aún no existen.
 */
export async function generatePlayerCharges(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const seasonId = String(formData.get("seasonId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");

  const team = await db.query.teams.findFirst({
    where: (teams, { eq }) => eq(teams.id, teamId),
    with: { season: true },
  });
  if (!team) return { error: t("teamNotFound") };
  if (team.playerFeeCents === null) return { error: t("feeNotConfigured") };

  const isMonthly = team.playerFeePeriod === "monthly";
  const isInstallments = team.playerFeePeriod === "installments";

  const monthlyKeys =
    isMonthly && team.season?.startsOn && team.season?.endsOn
      ? monthlyPeriodKeys(team.season.startsOn, team.season.endsOn)
      : [];
  if (isMonthly && monthlyKeys.length === 0) return { error: t("seasonDatesMissing") };

  const teamMemberships = await db.query.memberships.findMany({
    where: and(eq(memberships.teamId, teamId), eq(memberships.role, "player")),
    with: { person: { columns: PAYER_COLUMNS } },
  });
  if (teamMemberships.length === 0) return { error: t("noPlayers") };

  const payerIds = [...new Set(teamMemberships.map((m) => payerIdOf(m.person)))];
  const payerRows = await db.query.persons.findMany({
    where: inArray(persons.id, payerIds),
    columns: { id: true, iban: true, sepaConsent: true, firstName: true, lastName: true },
  });
  const payerById = new Map(payerRows.map((p) => [p.id, p]));

  const existing = await db.query.sepaCharges.findMany({
    where: and(
      eq(sepaCharges.seasonId, seasonId),
      inArray(
        sepaCharges.membershipId,
        teamMemberships.map((m) => m.id),
      ),
    ),
    columns: { membershipId: true, periodKey: true },
  });
  const existingKeys = new Set(existing.map((c) => `${c.membershipId}:${c.periodKey}`));

  /**
   * Plazos + importe de una membership. `null` cuando el equipo cobra en
   * plazos pero la membership no tiene `installmentsCount` informado: se
   * omite (cuenta como `skipped`) en vez de bloquear al resto del equipo.
   */
  function chargesFor(
    membership: (typeof teamMemberships)[number],
  ): { periodKey: string; amountCents: number }[] | null {
    const feeCents = team!.playerFeeCents!;
    if (isMonthly) {
      return monthlyKeys.map((periodKey) => ({ periodKey, amountCents: feeCents }));
    }
    if (isInstallments) {
      if (membership.installmentsCount === 1) {
        return [{ periodKey: "1", amountCents: feeCents }];
      }
      if (membership.installmentsCount === 2) {
        const first = Math.floor(feeCents / 2);
        return [
          { periodKey: "1", amountCents: first },
          { periodKey: "2", amountCents: feeCents - first },
        ];
      }
      return null;
    }
    return [{ periodKey: "season", amountCents: feeCents }];
  }

  let skipped = 0;
  const toGenerate: {
    membership: (typeof teamMemberships)[number];
    periodKey: string;
    amountCents: number;
  }[] = [];
  for (const membership of teamMemberships) {
    const plan = chargesFor(membership);
    if (plan === null) {
      skipped += 1;
      continue;
    }
    for (const { periodKey, amountCents } of plan) {
      if (!existingKeys.has(`${membership.id}:${periodKey}`)) {
        toGenerate.push({ membership, periodKey, amountCents });
      }
    }
  }
  if (toGenerate.length === 0) return { error: t("playerChargesAllExist") };

  /*
   * Los mandatos se resuelven de una tanda, antes del bucle: dentro eran dos
   * consultas por cargo (jugadores x meses), y el `sequenceType` salía mal
   * porque se consultaba una tabla en la que aún no se había insertado nada.
   */
  const mandates = await resolveMandates(
    payersToCharge(
      toGenerate.map(({ membership }) => payerIdOf(membership.person)),
      payerById,
    ),
  );
  const sequenceTypeFor = sequenceTypeAssigner();

  const rows: (typeof sepaCharges.$inferInsert)[] = [];
  for (const { membership, periodKey, amountCents } of toGenerate) {
    const payerId = payerIdOf(membership.person);
    const mandate = mandates.get(payerId);
    // Sin mandato = sin IBAN o sin consentimiento: `payersToCharge` lo dejó fuera.
    if (!mandate) {
      skipped += 1;
      continue;
    }
    rows.push({
      kind: "player",
      seasonId,
      membershipId: membership.id,
      payerPersonId: payerId,
      mandateId: mandate.id,
      periodKey,
      amountCents,
      sequenceType: sequenceTypeFor(mandate),
    });
  }
  if (rows.length === 0) return { error: t("allSkipped") };

  await db.insert(sepaCharges).values(rows);
  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "sepa_charge",
    entityId: teamId,
    metadata: { kind: "player", seasonId, teamId, count: rows.length, skipped },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("playerChargesGenerated", { count: rows.length, skipped }) };
}

/** Igual que `generatePlayerCharges`, para la cuota de socio (siempre `periodKey="season"`). */
export async function generateMemberCharges(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const seasonId = String(formData.get("seasonId") ?? "");

  const settings = await db.query.clubSettings.findFirst();
  if (!settings?.memberAnnualFeeCents) return { error: t("feeNotConfigured") };

  const activeMembers = await db.query.clubMembers.findMany({
    where: eq(clubMembers.status, "active"),
    with: { person: { columns: PAYER_COLUMNS } },
  });
  if (activeMembers.length === 0) return { error: t("noMembers") };

  const payerIds = [...new Set(activeMembers.map((m) => payerIdOf(m.person)))];
  const payerRows = await db.query.persons.findMany({
    where: inArray(persons.id, payerIds),
    columns: { id: true, iban: true, sepaConsent: true, firstName: true, lastName: true },
  });
  const payerById = new Map(payerRows.map((p) => [p.id, p]));

  const existing = await db.query.sepaCharges.findMany({
    where: and(
      eq(sepaCharges.seasonId, seasonId),
      eq(sepaCharges.periodKey, "season"),
      inArray(
        sepaCharges.clubMemberId,
        activeMembers.map((m) => m.id),
      ),
    ),
    columns: { clubMemberId: true },
  });
  const existingIds = new Set(existing.map((c) => c.clubMemberId));

  const toGenerate = activeMembers.filter((m) => !existingIds.has(m.id));
  if (toGenerate.length === 0) return { error: t("memberChargesAllExist") };

  // Mismo motivo que en `generatePlayerCharges`: una sola tanda antes del bucle.
  const mandates = await resolveMandates(
    payersToCharge(
      toGenerate.map((m) => payerIdOf(m.person)),
      payerById,
    ),
  );
  const sequenceTypeFor = sequenceTypeAssigner();

  let skipped = 0;
  const rows: (typeof sepaCharges.$inferInsert)[] = [];
  for (const clubMember of toGenerate) {
    const payerId = payerIdOf(clubMember.person);
    const mandate = mandates.get(payerId);
    // Sin mandato = sin IBAN o sin consentimiento: `payersToCharge` lo dejó fuera.
    if (!mandate) {
      skipped += 1;
      continue;
    }
    rows.push({
      kind: "member",
      seasonId,
      clubMemberId: clubMember.id,
      payerPersonId: payerId,
      mandateId: mandate.id,
      periodKey: "season",
      amountCents: settings.memberAnnualFeeCents,
      sequenceType: sequenceTypeFor(mandate),
    });
  }
  if (rows.length === 0) return { error: t("allSkipped") };

  await db.insert(sepaCharges).values(rows);
  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "sepa_charge",
    entityId: seasonId,
    metadata: { kind: "member", seasonId, count: rows.length, skipped },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("memberChargesGenerated", { count: rows.length, skipped }) };
}

/**
 * Agrupa los cargos `pending` sueltos (sin remesa) que casen los filtros en
 * una remesa nueva. Separado de la generación de cargos a propósito: para un
 * equipo mensual, "generar cargos" puebla de golpe todos los meses de la
 * temporada, y "crear remesa" es la acción recurrente que agrupa solo los de
 * un mes.
 */
export async function createRemittance(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const kind = String(formData.get("kind") ?? "") as "player" | "member";
  const seasonId = String(formData.get("seasonId") ?? "");
  const teamId = String(formData.get("teamId") ?? "") || null;
  const periodKey = String(formData.get("periodKey") ?? "");
  const collectionDate = String(formData.get("collectionDate") ?? "");
  if (!collectionDate) return { error: t("collectionDateRequired") };

  const settings = await db.query.clubSettings.findFirst();
  if (!settings?.sepaCreditorId || !settings.iban || !settings.legalName) {
    return { error: t("creditorDataMissing") };
  }

  let chargeIds: string[];
  if (kind === "player" && teamId) {
    const rows = await db
      .select({ id: sepaCharges.id })
      .from(sepaCharges)
      .innerJoin(memberships, eq(sepaCharges.membershipId, memberships.id))
      .where(
        and(
          eq(sepaCharges.kind, "player"),
          eq(sepaCharges.seasonId, seasonId),
          eq(sepaCharges.periodKey, periodKey),
          eq(sepaCharges.status, "pending"),
          isNull(sepaCharges.remittanceId),
          eq(memberships.teamId, teamId),
        ),
      );
    chargeIds = rows.map((r) => r.id);
  } else {
    const rows = await db.query.sepaCharges.findMany({
      where: and(
        eq(sepaCharges.kind, "member"),
        eq(sepaCharges.seasonId, seasonId),
        eq(sepaCharges.periodKey, periodKey),
        eq(sepaCharges.status, "pending"),
        isNull(sepaCharges.remittanceId),
      ),
      columns: { id: true },
    });
    chargeIds = rows.map((r) => r.id);
  }
  if (chargeIds.length === 0) return { error: t("remittanceEmpty") };

  const messageId = await nextRemittanceMessageId();
  const [remittance] = await db
    .insert(sepaRemittances)
    .values({
      kind,
      seasonId,
      teamId: kind === "player" ? teamId : null,
      periodKey,
      messageId,
      collectionDate,
      generatedByUserId: user.id,
    })
    .returning();

  await db
    .update(sepaCharges)
    .set({ remittanceId: remittance.id })
    .where(inArray(sepaCharges.id, chargeIds));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "sepa_remittance",
    entityId: remittance.id,
    metadata: { kind, seasonId, teamId, periodKey, count: chargeIds.length },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("remittanceCreated", { messageId }) };
}

/** Cambia el estado de un cargo a `collected` o `returned` (con motivo). */
export async function updateChargeStatus(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "collected" | "returned";
  const returnReason = String(formData.get("returnReason") ?? "").trim() || null;
  const today = new Date().toISOString().slice(0, 10);

  if (status === "returned") {
    // La fila se reutiliza (ver comentario más abajo) y su `remittanceId` se
    // va a anular, así que hay que guardar la remesa de origen antes de
    // perderla, o no quedaría traza de qué remesa se devolvió.
    const current = await db.query.sepaCharges.findFirst({
      where: eq(sepaCharges.id, id),
      columns: { remittanceId: true },
    });
    await db.insert(sepaChargeReturns).values({
      chargeId: id,
      remittanceId: current?.remittanceId ?? null,
      returnedOn: today,
      returnReason,
    });
  }

  await db
    .update(sepaCharges)
    .set(
      status === "collected"
        ? { status: "collected", collectedOn: today }
        // Un cargo devuelto sigue debiéndose: vuelve a quedar suelto y
        // "pending" para poder entrar en la próxima remesa (el índice único
        // por membresía/temporada/periodo impide crear un cargo nuevo para
        // el mismo periodo, así que se reutiliza la misma fila).
        : { status: "pending", remittanceId: null, returnedOn: today, returnReason },
    )
    .where(eq(sepaCharges.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "sepa_charge",
    entityId: id,
    metadata: { status, returnReason },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha, ROUTE.personaFicha);
  return { message: status === "collected" ? t("chargeMarkedCollected") : t("chargeMarkedReturned") };
}

/** Marca como cobrados todos los cargos `pending` de una remesa, en un clic. */
export async function markRemittanceCollected(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const remittanceId = String(formData.get("remittanceId") ?? "");
  const today = new Date().toISOString().slice(0, 10);

  await db
    .update(sepaCharges)
    .set({ status: "collected", collectedOn: today })
    .where(and(eq(sepaCharges.remittanceId, remittanceId), eq(sepaCharges.status, "pending")));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "sepa_remittance",
    entityId: remittanceId,
    metadata: { bulkStatus: "collected" },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("remittanceMarkedCollected") };
}

/**
 * Borra una remesa entera. El cargo es el hecho contable y sobrevive
 * (`onDelete: "set null"` en `sepaCharges.remittanceId`) — vuelve a quedar
 * suelto con el estado que tuviera, listo para entrar en otra remesa si
 * seguía `pending`.
 */
export async function deleteRemittance(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const id = String(formData.get("id") ?? "");
  const remittance = await db.query.sepaRemittances.findFirst({
    where: eq(sepaRemittances.id, id),
    columns: { messageId: true },
  });
  if (!remittance) return { error: t("remittanceNotFound") };

  await db.delete(sepaRemittances).where(eq(sepaRemittances.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "sepa_remittance",
    entityId: id,
    metadata: { messageId: remittance.messageId },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("remittanceDeleted") };
}

/** Borra un cargo suelto, solo si sigue `pending` (uno ya cobrado o devuelto es histórico). */
export async function deleteCharge(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const id = String(formData.get("id") ?? "");
  const charge = await db.query.sepaCharges.findFirst({
    where: eq(sepaCharges.id, id),
    columns: { status: true },
  });
  if (!charge) return { error: t("remittanceNotFound") };
  if (charge.status !== "pending") return { error: t("chargeNotPending") };

  await db.delete(sepaCharges).where(eq(sepaCharges.id, id));

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "sepa_charge",
    entityId: id,
    metadata: {},
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("chargeDeleted") };
}

/** Borra en bloque los cargos `pending` sueltos (sin remesa) de un grupo de la tabla de pendientes. */
export async function deletePendingCharges(
  _prev: CuotasState,
  formData: FormData,
): Promise<CuotasState> {
  const t = await getTranslations("Cuotas");
  const user = await requirePermission("cuotas.manage");

  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (ids.length === 0) return { error: t("remittanceNotFound") };

  const deleted = await db
    .delete(sepaCharges)
    .where(
      and(
        inArray(sepaCharges.id, ids),
        eq(sepaCharges.status, "pending"),
        isNull(sepaCharges.remittanceId),
      ),
    )
    .returning({ id: sepaCharges.id });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "sepa_charge",
    entityId: ids[0],
    metadata: { count: deleted.length },
  });

  revalidateRoutes(ROUTE.cuotas, ROUTE.cuotaFicha);
  return { message: t("pendingChargesDeleted", { count: deleted.length }) };
}

/** Reconstruye y devuelve el XML pain.008 de una remesa ya generada. */
export async function getRemittanceXml(
  remittanceId: string,
): Promise<{ filename: string; xml: string } | { error: string }> {
  const t = await getTranslations("Cuotas");
  await requirePermission("cuotas.view");

  const remittance = await db.query.sepaRemittances.findFirst({
    where: eq(sepaRemittances.id, remittanceId),
    with: { team: true, season: true },
  });
  if (!remittance) return { error: t("remittanceNotFound") };

  const settings = await db.query.clubSettings.findFirst();
  if (!settings?.sepaCreditorId || !settings.iban || !settings.legalName) {
    return { error: t("creditorDataMissing") };
  }

  const charges = await db.query.sepaCharges.findMany({
    where: eq(sepaCharges.remittanceId, remittanceId),
    with: {
      mandate: true,
      payer: true,
      membership: { with: { team: true } },
    },
  });
  if (charges.length === 0) return { error: t("remittanceEmpty") };

  const concept =
    remittance.kind === "player"
      ? `Cuota jugador - ${remittance.team?.name ?? ""} - ${remittance.periodKey}`.trim()
      : `Cuota socio - ${remittance.season?.name ?? remittance.periodKey}`;

  const xmlCharges: SepaChargeForXml[] = charges.map((charge) => ({
    amountCents: charge.amountCents,
    endToEndId: charge.id.replace(/-/g, ""),
    mandateId: charge.mandate.rum,
    mandateSignedOn: charge.mandate.signedOn,
    sequenceType: charge.sequenceType,
    debtorName: `${charge.payer.firstName} ${charge.payer.lastName}`,
    debtorIban: charge.mandate.ibanSnapshot,
    concept,
  }));

  const xml = buildPain008({
    messageId: remittance.messageId,
    creationDateTime: new Date(),
    collectionDate: remittance.collectionDate,
    creditor: {
      legalName: settings.legalName,
      iban: settings.iban,
      sepaCreditorId: settings.sepaCreditorId,
    },
    charges: xmlCharges,
  });

  return { filename: `remesa-${remittance.messageId}.xml`, xml };
}
