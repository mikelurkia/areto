"use client";

import { useActionState, useCallback } from "react";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { sendInjuryReportByEmail, type PersonState } from "@/app/[locale]/(app)/personas/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

const initialState: PersonState = {};

type Recipient = { value: string; label: string };

/**
 * No hay proveedor de email en el servidor: la acción firma el enlace de
 * descarga y devuelve un `mailto:` (`PersonState.mailto`) que abre aquí el
 * cliente de correo del propio usuario, con el destinatario elegido.
 */
export function SendInjuryReportDialog({
  reportId,
  person,
  guardians,
}: {
  reportId: string;
  person: { name: string; email: string | null };
  guardians: { id: string; name: string; email: string | null }[];
}) {
  const t = useTranslations("Personas");
  const [open, setOpen] = useDialogParam(`parte-enviar:${reportId}`);
  const [state, action] = useActionState(sendInjuryReportByEmail, initialState);
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);
  useActionResult(
    state,
    useCallback((result: PersonState) => {
      if (result.mailto) window.location.href = result.mailto;
    }, []),
  );

  const recipients: Recipient[] = [
    ...(person.email
      ? [{ value: "person", label: t("sendInjuryReportRecipientSelf", { name: person.name }) }]
      : []),
    ...guardians
      .filter((guardian) => guardian.email)
      .map((guardian) => ({
        value: `guardian:${guardian.id}`,
        label: t("sendInjuryReportRecipientGuardian", { name: guardian.name }),
      })),
  ];

  // Nadie con correo al que enviar: no tiene sentido ofrecer el diálogo.
  if (recipients.length === 0) return null;

  function label(value: string) {
    return recipients.find((r) => r.value === value)?.label ?? "";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 text-muted-foreground hover:underline"
          />
        }
      >
        <SendIcon className="size-3.5" />
        {t("sendInjuryReportAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sendInjuryReportTitle")}</DialogTitle>
          <DialogDescription>{t("sendInjuryReportDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={reportId} />
          <Field>
            <FieldLabel htmlFor="send-injury-report-recipient">
              {t("sendInjuryReportRecipientLabel")}
            </FieldLabel>
            <Select name="recipient" defaultValue={recipients[0]?.value}>
              <SelectTrigger id="send-injury-report-recipient" className="w-full">
                <SelectValue>{(value: string) => label(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {recipients.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("sendInjuryReportAction")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
