"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { clubPaymentMethods } from "@/db/schema";
import { hasPermission, requirePermission, requireUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";
import { cardLast4, isValidCardNumber, normalizeCardNumber } from "@/lib/card";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/secret-box";
import type { ClubState } from "./actions";

/**
 * Tarjetas del club. Fichero aparte de `actions.ts` porque van con otro permiso
 * (`club.payments.*`) y porque `revealCardNumber` no es una acción de
 * formulario. Ninguna toca `CLUB_SETTINGS_TAG`: es otra tabla, y
 * `getClubPaymentMethods` no está cacheada entre peticiones.
 */

/** Campos comunes de alta y edición, ya validados. `null` si algo no cuadra. */
async function readFields(formData: FormData) {
  const t = await getTranslations("Club");

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("paymentMethodLabelRequired") } as const;

  const month = Number(formData.get("expiryMonth"));
  const year = Number(formData.get("expiryYear"));
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    return { error: t("paymentMethodExpiryInvalid") } as const;
  }

  return {
    values: {
      label,
      holderName: String(formData.get("holderName") ?? "").trim() || null,
      expiryMonth: month,
      expiryYear: year,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  } as const;
}

export async function createPaymentMethod(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  const user = await requirePermission("club.payments.manage");
  if (!isEncryptionConfigured()) return { error: t("encryptionKeyMissingTitle") };

  const parsed = await readFields(formData);
  if ("error" in parsed) return parsed;

  const number = normalizeCardNumber(String(formData.get("number") ?? ""));
  if (!isValidCardNumber(number)) return { error: t("paymentMethodNumberInvalid") };

  const [created] = await db
    .insert(clubPaymentMethods)
    .values({
      ...parsed.values,
      numberEncrypted: encryptSecret(number),
      last4: cardLast4(number),
    })
    .returning({ id: clubPaymentMethods.id });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "create",
    entityType: "club_payment_method",
    entityId: created.id,
    metadata: { label: parsed.values.label, last4: cardLast4(number) },
  });
  revalidateRoutes(ROUTE.club);
  return { message: t("paymentMethodSaved") };
}

export async function updatePaymentMethod(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  const user = await requirePermission("club.payments.manage");
  if (!isEncryptionConfigured()) return { error: t("encryptionKeyMissingTitle") };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t("paymentMethodNotFound") };

  const parsed = await readFields(formData);
  if ("error" in parsed) return parsed;

  // Número vacío = "no lo cambies": no se obliga a reteclear 16 dígitos para
  // corregir la etiqueta o la caducidad.
  const number = normalizeCardNumber(String(formData.get("number") ?? ""));
  if (number && !isValidCardNumber(number)) {
    return { error: t("paymentMethodNumberInvalid") };
  }

  const updated = await db
    .update(clubPaymentMethods)
    .set({
      ...parsed.values,
      ...(number
        ? { numberEncrypted: encryptSecret(number), last4: cardLast4(number) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(clubPaymentMethods.id, id))
    .returning({ id: clubPaymentMethods.id });
  if (updated.length === 0) return { error: t("paymentMethodNotFound") };

  await recordAuditEvent({
    actorUserId: user.id,
    action: "update",
    entityType: "club_payment_method",
    entityId: id,
    metadata: { label: parsed.values.label, numberChanged: Boolean(number) },
  });
  revalidateRoutes(ROUTE.club);
  return { message: t("paymentMethodSaved") };
}

export async function deletePaymentMethod(
  _prev: ClubState,
  formData: FormData,
): Promise<ClubState> {
  const t = await getTranslations("Club");
  const user = await requirePermission("club.payments.manage");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t("paymentMethodNotFound") };

  const deleted = await db
    .delete(clubPaymentMethods)
    .where(eq(clubPaymentMethods.id, id))
    .returning({ label: clubPaymentMethods.label, last4: clubPaymentMethods.last4 });
  if (deleted.length === 0) return { error: t("paymentMethodNotFound") };

  await recordAuditEvent({
    actorUserId: user.id,
    action: "delete",
    entityType: "club_payment_method",
    entityId: id,
    metadata: { label: deleted[0].label, last4: deleted[0].last4 },
  });
  revalidateRoutes(ROUTE.club);
  return { message: t("paymentMethodDeleted") };
}

/**
 * Única vía por la que el número completo sale del servidor. No es una acción
 * de `useActionState`: la llama un `onClick`, así que comprueba el permiso a
 * mano en vez de con `requirePermission` (que hace `redirect()`, un
 * comportamiento indeseable fuera del envío de un formulario).
 *
 * Cada revelado queda en `audit_log`: es la traza que hace falta si un número
 * acaba donde no debe.
 */
export async function revealCardNumber(
  id: string,
): Promise<{ number: string } | { error: string }> {
  const t = await getTranslations("Club");
  const user = await requireUser();
  if (!hasPermission(user, "club.payments.view")) {
    return { error: t("paymentMethodForbidden") };
  }

  const row = await db.query.clubPaymentMethods.findFirst({
    where: eq(clubPaymentMethods.id, id),
    columns: { numberEncrypted: true, label: true, last4: true },
  });
  if (!row) return { error: t("paymentMethodNotFound") };

  let number: string;
  try {
    number = decryptSecret(row.numberEncrypted);
  } catch {
    // Clave ausente, rotada o valor manipulado. No tumba la página.
    return { error: t("cardRevealFailed") };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    action: "view",
    entityType: "club_payment_method",
    entityId: id,
    metadata: { label: row.label, last4: row.last4 },
  });
  return { number };
}
