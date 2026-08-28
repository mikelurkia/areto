"use client";

import { SectionPlaceholder } from "@/components/section-placeholder";
import { useActionState, useState } from "react";
import { CopyPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { importTeamsFromSeason } from "@/app/[locale]/(app)/equipos/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

type SourceTeam = {
  id: string;
  name: string;
  label: string;
  alreadyImported: boolean;
};

type SourceSeason = {
  id: string;
  name: string;
  teams: SourceTeam[];
};

/**
 * Trae en lote los equipos de otra temporada a la temporada destino (la versión
 * masiva de "renovar equipo"). Solo se renderiza si hay temporadas de origen con
 * equipos. Los equipos ya traídos aparecen marcados y deshabilitados.
 */
export function ImportTeamsDialog({
  targetSeasonId,
  sourceSeasons,
  variant = "outline",
}: {
  targetSeasonId: string;
  sourceSeasons: SourceSeason[];
  variant?: "outline" | "default";
}) {
  const t = useTranslations("Temporadas");
  const [open, setOpen] = useDialogParam(`traer-equipos:${targetSeasonId}`);
  const [state, formAction] = useActionState(importTeamsFromSeason, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const importableOf = (seasonId: string) =>
    new Set(
      sourceSeasons
        .find((s) => s.id === seasonId)
        ?.teams.filter((tm) => !tm.alreadyImported)
        .map((tm) => tm.id) ?? [],
    );

  const [sourceId, setSourceId] = useState(sourceSeasons[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(() =>
    importableOf(sourceSeasons[0]?.id ?? ""),
  );

  function changeSource(seasonId: string | null) {
    const next = seasonId ?? "";
    setSourceId(next);
    setSelected(importableOf(next));
  }

  function toggle(teamId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(teamId);
      else next.delete(teamId);
      return next;
    });
  }

  const source = sourceSeasons.find((s) => s.id === sourceId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} />}>
        <CopyPlusIcon data-icon="inline-start" />
        {t("importTeamsAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("importTeamsTitle")}</DialogTitle>
          <DialogDescription>{t("importTeamsDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="targetSeasonId" value={targetSeasonId} />
          <input type="hidden" name="sourceSeasonId" value={sourceId} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="teamIds" value={id} />
          ))}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="import-source-season">
                {t("sourceSeasonLabel")}
              </FieldLabel>
              <Select value={sourceId} onValueChange={changeSource}>
                <SelectTrigger id="import-source-season" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      sourceSeasons.find((s) => s.id === value)?.name ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sourceSeasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("selectTeamsLabel")}</FieldLabel>
              <Card size="sm" className="gap-2 px-(--card-spacing)">
                {source && source.teams.length > 0 ? (
                  source.teams.map((tm) => (
                    <label
                      key={tm.id}
                      className="flex items-center gap-2 text-sm data-[disabled]:opacity-60"
                      data-disabled={tm.alreadyImported ? "" : undefined}
                    >
                      <Checkbox
                        checked={tm.alreadyImported || selected.has(tm.id)}
                        disabled={tm.alreadyImported}
                        onCheckedChange={(checked) => toggle(tm.id, checked === true)}
                      />
                      <span className="font-medium">{tm.name}</span>
                      {tm.label ? (
                        <span className="text-muted-foreground">· {tm.label}</span>
                      ) : null}
                      {tm.alreadyImported ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {t("alreadyImportedNote")}
                        </span>
                      ) : null}
                    </label>
                  ))
                ) : (
                  <SectionPlaceholder size="compact" title={t("noTeamsReadonly")} />
                )}
              </Card>
            </Field>

            <Field orientation="horizontal">
              <Checkbox id="import-copy-roster" name="copyRoster" defaultChecked />
              <Label htmlFor="import-copy-roster" className="font-normal">
                {t("copyRosterLabel")}
              </Label>
            </Field>

            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <SubmitButton disabled={selected.size === 0}>
                {t("importConfirm")}
              </SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
