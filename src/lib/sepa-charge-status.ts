import type { StatusTone } from "@/lib/status-tone";

export type SepaChargeStatus = "pending" | "collected" | "returned";

/** Tono por estado de cargo SEPA, igual en el listado y en el detalle de remesa. */
export const SEPA_CHARGE_TONE: Record<SepaChargeStatus, StatusTone> = {
  pending: "neutral",
  collected: "positive",
  returned: "danger",
};
