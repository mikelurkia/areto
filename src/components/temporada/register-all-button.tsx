"use client";

import { useActionState } from "react";
import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { registerAllTeamPlayers } from "@/app/[locale]/(app)/temporadas/actions";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";

export function RegisterAllButton({ teamId }: { teamId: string }) {
  const t = useTranslations("Temporadas");
  const [state, action] = useActionState(registerAllTeamPlayers, {});
  useActionToast(state.message);

  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} />
      <SubmitButton variant="outline" size="sm">
        <UsersIcon data-icon="inline-start" />
        {t("registerAllAction")}
      </SubmitButton>
    </form>
  );
}
