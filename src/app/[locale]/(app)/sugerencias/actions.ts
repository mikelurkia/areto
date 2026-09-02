"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { featureRequests, featureRequestStatus } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type FeatureRequestActionState = {
  error?: string;
  message?: string;
};

export async function createFeatureRequest(
  _prev: FeatureRequestActionState,
  formData: FormData,
): Promise<FeatureRequestActionState> {
  const t = await getTranslations("Sugerencias");
  const user = await requirePermission("sugerencias.view");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return { error: t("titleRequired") };
  if (!description) return { error: t("descriptionRequired") };

  await db.insert(featureRequests).values({
    title,
    description,
    requestedByUserId: user.id,
  });

  revalidateRoutes(ROUTE.sugerencias);
  return { message: t("requestCreated") };
}

export async function updateFeatureRequestStatus(
  _prev: FeatureRequestActionState,
  formData: FormData,
): Promise<FeatureRequestActionState> {
  const t = await getTranslations("Sugerencias");
  await requirePermission("sugerencias.manage");

  const id = String(formData.get("id") ?? "");
  const statusValue = String(formData.get("status") ?? "");
  const status = (
    featureRequestStatus.enumValues as readonly string[]
  ).includes(statusValue)
    ? (statusValue as (typeof featureRequestStatus.enumValues)[number])
    : "pending";

  await db
    .update(featureRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(featureRequests.id, id));

  revalidateRoutes(ROUTE.sugerencias);
  return { message: t("statusUpdated") };
}
