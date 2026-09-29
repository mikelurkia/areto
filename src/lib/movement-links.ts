import "server-only";

import { eq, sum } from "drizzle-orm";

import { db } from "@/db";
import { movementLinks } from "@/db/schema";
import { checkMovementLink, type LinkCheck, type LinkTargetKind } from "@/lib/economia";

/** Columna de `movement_links` que corresponde a cada tipo de documento. */
const TARGET_COLUMN = {
  received: movementLinks.receivedInvoiceId,
  issued: movementLinks.issuedInvoiceId,
  receipt: movementLinks.purchaseReceiptId,
  remittance: movementLinks.sepaRemittanceId,
  sponsorPayment: movementLinks.sponsorPaymentId,
} as const satisfies Record<LinkTargetKind, unknown>;

/**
 * Lo mismo que comprueba el diálogo en vivo, pero contra la base de datos: lee
 * lo ya imputado al apunte y al documento y delega en el validador puro, para
 * que cliente y servidor no puedan discrepar.
 *
 * Dos envíos simultáneos podrían pasar los dos esta comprobación. Con el
 * tamaño del club no compensa un trigger: el estado `over` hace que el
 * resultado se vea en vez de quedarse escondido.
 */
export async function checkLinkAgainstDb(input: {
  movementId: string;
  kind: LinkTargetKind;
  documentId: string;
  documentTotalCents: number;
  movementAmountCents: number;
  amountCents: number;
}): Promise<LinkCheck> {
  const [movementRows, documentRows] = await Promise.all([
    db
      .select({ total: sum(movementLinks.amountCents) })
      .from(movementLinks)
      .where(eq(movementLinks.movementId, input.movementId)),
    db
      .select({ total: sum(movementLinks.amountCents) })
      .from(movementLinks)
      .where(eq(TARGET_COLUMN[input.kind], input.documentId)),
  ]);

  return checkMovementLink({
    kind: input.kind,
    amountCents: input.amountCents,
    movementAmountCents: input.movementAmountCents,
    movementLinkedCents: Number(movementRows[0]?.total ?? 0),
    documentTotalCents: input.documentTotalCents,
    documentLinkedCents: Number(documentRows[0]?.total ?? 0),
  });
}
