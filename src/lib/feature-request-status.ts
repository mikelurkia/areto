import type { StatusTone } from "@/lib/status-tone";

/** Estados posibles de una petición de funcionalidad; ver `featureRequests.status` en el esquema. */
export type FeatureRequestStatus = "pending" | "in_review" | "done" | "discarded";

export const STATUS_TONE: Record<FeatureRequestStatus, StatusTone> = {
  pending: "neutral",
  in_review: "warning",
  done: "positive",
  discarded: "danger",
};
