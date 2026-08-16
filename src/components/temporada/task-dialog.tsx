"use client";

import { useActionState, useState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createSeasonTask, updateSeasonTask } from "@/app/[locale]/(app)/temporadas/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";
import type { SeasonTaskKind, SeasonTaskStatus } from "@/lib/season-tasks";

const KINDS: SeasonTaskKind[] = [
  "inscripcion_liga",
  "inscripcion_copa",
  "alta_equipo_plataforma",
  "alta_jugadores_plataforma",
  "otro",
];
const STATUSES: SeasonTaskStatus[] = ["pending", "in_progress", "done"];

const PROOF_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

type TeamOption = { id: string; label: string };

type Task = {
  id: string;
  teamId: string | null;
  kind: SeasonTaskKind;
  title: string;
  status: SeasonTaskStatus;
  dueDate: string | null;
  amountCents: number | null;
  paidOn: string | null;
  assignee: string | null;
  notes: string | null;
  hasProof: boolean;
  hasDoc: boolean;
};

type TaskDialogProps =
  | { mode: "create"; seasonId: string; teamOptions: TeamOption[]; defaultTeamId?: string }
  | {
      mode: "edit";
      task: Task;
      teamOptions: TeamOption[];
      proofUrl: string | null;
      docUrl: string | null;
    };

export function TaskDialog(props: TaskDialogProps) {
  const t = useTranslations("Temporadas");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    props.mode === "create" ? createSeasonTask : updateSeasonTask,
    {},
  );
  useActionToast(state.message);
  useCloseOnActionSuccess(state, setOpen);

  const task = useFrozenWhileOpen(open, props.mode === "edit" ? props.task : null);
  const proofUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.proofUrl : null);
  const docUrl = useFrozenWhileOpen(open, props.mode === "edit" ? props.docUrl : null);
  const teamOptions = props.teamOptions;

  const defaultTeamId =
    props.mode === "edit"
      ? (props.task.teamId ?? "none")
      : (props.defaultTeamId ?? "none");
  const amountValue =
    task?.amountCents != null ? (task.amountCents / 100).toString() : "";

  function teamLabel(value: string) {
    return value === "none"
      ? t("teamNone")
      : (teamOptions.find((o) => o.id === value)?.label ?? value);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button size="sm" />}>
          <PlusIcon data-icon="inline-start" />
          {t("addTaskAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editTaskSr", { title: props.task.title })}</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newTaskTitle") : t("editTaskTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="seasonId" value={props.seasonId} />
          ) : (
            <input type="hidden" name="id" value={task!.id} />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="task-title">{t("titleLabel")}</FieldLabel>
              <Input
                id="task-title"
                name="title"
                defaultValue={task?.title ?? ""}
                placeholder={t("titlePlaceholder")}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="task-kind">{t("kindLabel")}</FieldLabel>
                <Select name="kind" defaultValue={task?.kind ?? "otro"}>
                  <SelectTrigger id="task-kind" className="w-full">
                    <SelectValue>{(v: string) => t(`kindOption.${v}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`kindOption.${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-team">{t("teamLabel")}</FieldLabel>
                <Select name="teamId" defaultValue={defaultTeamId}>
                  <SelectTrigger id="task-team" className="w-full">
                    <SelectValue>{(v: string) => teamLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("teamNone")}</SelectItem>
                    {teamOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="task-status">{t("statusLabel")}</FieldLabel>
                <Select name="status" defaultValue={task?.status ?? "pending"}>
                  <SelectTrigger id="task-status" className="w-full">
                    <SelectValue>{(v: string) => t(`status.${v}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-due">{t("dueDateLabel")}</FieldLabel>
                <Input
                  id="task-due"
                  name="dueDate"
                  type="date"
                  defaultValue={task?.dueDate ?? ""}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="task-amount">{t("amountLabel")}</FieldLabel>
                <Input
                  id="task-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="250"
                  defaultValue={amountValue}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-paid-on">{t("paidOnLabel")}</FieldLabel>
                <Input
                  id="task-paid-on"
                  name="paidOn"
                  type="date"
                  defaultValue={task?.paidOn ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="task-assignee">{t("assigneeLabel")}</FieldLabel>
              <Input
                id="task-assignee"
                name="assignee"
                defaultValue={task?.assignee ?? ""}
                placeholder={t("assigneePlaceholder")}
              />
            </Field>

            {props.mode === "edit" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="task-proof">{t("proofLabel")}</FieldLabel>
                  {proofUrl ? (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <PaperclipIcon className="size-3.5" />
                      {t("viewProof")}
                    </a>
                  ) : null}
                  <Input id="task-proof" name="proof" type="file" accept={PROOF_ACCEPT} />
                  {task!.hasProof ? (
                    <Field orientation="horizontal" className="mt-1">
                      <Checkbox id="task-remove-proof" name="removeProof" />
                      <Label htmlFor="task-remove-proof" className="font-normal">
                        {t("removeProof")}
                      </Label>
                    </Field>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-doc">{t("docLabel")}</FieldLabel>
                  {docUrl ? (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <PaperclipIcon className="size-3.5" />
                      {t("viewDoc")}
                    </a>
                  ) : null}
                  <Input id="task-doc" name="doc" type="file" accept={PROOF_ACCEPT} />
                  {task!.hasDoc ? (
                    <Field orientation="horizontal" className="mt-1">
                      <Checkbox id="task-remove-doc" name="removeDoc" />
                      <Label htmlFor="task-remove-doc" className="font-normal">
                        {t("removeDoc")}
                      </Label>
                    </Field>
                  ) : null}
                </Field>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t("filesAfterCreateHint")}</p>
            )}

            <Field>
              <FieldLabel htmlFor="task-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="task-notes"
                name="notes"
                defaultValue={task?.notes ?? ""}
                placeholder={t("notesPlaceholder")}
              />
            </Field>
          </FieldGroup>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>
              {props.mode === "create" ? t("addTaskAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
