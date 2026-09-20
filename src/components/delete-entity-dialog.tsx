"use client";

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

type EntityKey =
  | "Document"
  | "Qualification"
  | "MedicalCheckup"
  | "InjuryReport"
  | "InjuryReportFile"
  | "Team"
  | "Person"
  | "Sponsor"
  | "Season"
  | "Member"
  | "Remittance"
  | "Charge"
  | "Account"
  | "Movement"
  | "Supplier"
  | "ReceivedInvoice"
  | "PurchaseReceipt"
  | "MovementLink"
  | "PaymentMethod";

/** Forma común de las Server Actions de borrado (documentos, titulaciones, médico, lesiones...). */
type DeleteActionState = { error?: string; message?: string };

/**
 * Diálogo de confirmación de borrado genérico, compartido por documentos,
 * titulaciones, reconocimientos médicos, partes de lesión y las entidades
 * principales (equipos, personas, patrocinadores, temporadas, membresías).
 * `verb` + `entityKey` construyen las claves de traducción
 * (`${verb}${entityKey}Sr/Title/Description/Button`, p. ej. `deleteTeamTitle`
 * o `removeMemberTitle`); `values` es el objeto de interpolación que espera
 * cada mensaje (varía por entidad: `{label}`, `{title}`, `{date}`, `{name}`),
 * así no hay que tocar `messages/*.json` para unificar este componente.
 */
export function DeleteEntityDialog({
  id,
  namespace,
  entityKey,
  verb = "delete",
  paramKey,
  values,
  confirmValue,
  deleteAction,
}: {
  id: string;
  namespace:
    | "Personas"
    | "Equipos"
    | "Patrocinadores"
    | "Temporadas"
    | "Cuotas"
    | "Economia"
    | "Club";
  entityKey: EntityKey;
  verb?: "delete" | "remove";
  paramKey: string;
  values: Record<string, string>;
  /**
   * Cuando se pasa, el borrado exige teclear este valor exacto (p. ej. el
   * nombre del equipo) para habilitar el botón — fricción reservada a
   * entidades de radio de impacto alto, no al borrado por defecto.
   */
  confirmValue?: string;
  deleteAction: (
    prev: DeleteActionState,
    formData: FormData,
  ) => Promise<DeleteActionState> | DeleteActionState;
}) {
  const t = useTranslations(namespace);
  const [open, setOpen] = useDialogParam(`${paramKey}:${id}`);
  const [state, action] = useActionState(deleteAction, {});
  const [confirmInput, setConfirmInput] = useState("");
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setConfirmInput("");
  }

  const confirmed = confirmValue === undefined || confirmInput.trim() === confirmValue;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-destructive" />}
      >
        <Trash2Icon />
        <span className="sr-only">
          {t(`${verb}${entityKey}Sr` as "deleteDocumentSr", values)}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${verb}${entityKey}Title` as "deleteDocumentTitle", values)}</DialogTitle>
          <DialogDescription>
            {t(`${verb}${entityKey}Description` as "deleteDocumentDescription", values)}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          {confirmValue !== undefined ? (
            <Field>
              <FieldLabel htmlFor={`confirm-${id}`}>
                {t(`${verb}${entityKey}ConfirmLabel` as "deleteTeamConfirmLabel", {
                  value: confirmValue,
                })}
              </FieldLabel>
              <Input
                id={`confirm-${id}`}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                autoComplete="off"
              />
            </Field>
          ) : null}
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive" disabled={!confirmed}>
              {t(`${verb}${entityKey}Button` as "deleteDocumentButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
