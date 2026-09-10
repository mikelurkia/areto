"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TeamForm } from "@/components/equipos/team-form";
import { useDialogParam } from "@/hooks/use-dialog-param";

type Team = {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  federationGroup: string | null;
  federationCode: string | null;
  registrationStatus: string;
  playerFeeCents: number | null;
  playerFeePeriod: string;
  playerFeeNotes: string | null;
};

export function TeamEditDialog({ team }: { team: Team }) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useDialogParam(`editar-equipo:${team.id}`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">{t("editTeamSr", { name: team.name })}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editTeamTitle", { name: team.name })}</DialogTitle>
        </DialogHeader>
        <TeamForm mode="edit" team={team} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
