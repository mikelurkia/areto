"use client";

import { startTransition, useActionState } from "react";
import { useTranslations } from "next-intl";

import { updateFeatureRequestStatus } from "@/app/[locale]/(app)/sugerencias/actions";
import type { FeatureRequestStatus } from "@/lib/feature-request-status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";

const STATUSES: FeatureRequestStatus[] = ["pending", "in_review", "done", "discarded"];

export function FeatureRequestStatusSelect({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: FeatureRequestStatus;
}) {
  const t = useTranslations("Sugerencias");
  const [state, formAction] = useActionState(updateFeatureRequestStatus, {});
  useActionToast(state);

  return (
    <Select
      value={status}
      onValueChange={(next) => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("status", next as string);
        startTransition(() => formAction(formData));
      }}
      aria-label={t("changeStatusSr", { title })}
    >
      <SelectTrigger size="sm">
        <SelectValue>{(value: FeatureRequestStatus) => t(`status.${value}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {t(`status.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
