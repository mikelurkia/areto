"use client";

import { useActionState } from "react";
import { UserRoundPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { generateMemberCharges } from "@/app/[locale]/(app)/cuotas/actions";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function GenerateMemberChargesButton({ seasonId }: { seasonId: string }) {
  const t = useTranslations("Cuotas");
  const [state, action] = useActionState(generateMemberCharges, {});
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="seasonId" value={seasonId} />
      <SubmitButton variant="outline" size="sm">
        <UserRoundPlusIcon data-icon="inline-start" />
        {t("generateMemberChargesAction")}
      </SubmitButton>
    </form>
  );
}
