"use client";

import { useActionState } from "react";
import { BanIcon, FileMinus2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  cancelIssuedInvoice,
  rectifyIssuedInvoice,
} from "@/app/[locale]/(app)/economia/emitidas/actions";
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
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

/**
 * Las dos únicas salidas de una factura emitida. No hay borrado: dejaría un
 * hueco permanente en la numeración fiscal (decisión 7 del plan).
 */
export function IssuedInvoiceStatusActions({ id, number }: { id: string; number: string }) {
  return (
    <>
      <ConfirmAction
        id={id}
        number={number}
        kind="rectify"
        action={rectifyIssuedInvoice}
        icon={<FileMinus2Icon data-icon="inline-start" />}
      />
      <ConfirmAction
        id={id}
        number={number}
        kind="cancel"
        action={cancelIssuedInvoice}
        icon={<BanIcon data-icon="inline-start" />}
      />
    </>
  );
}

type ActionState = { error?: string; message?: string };

function ConfirmAction({
  id,
  number,
  kind,
  action,
  icon,
}: {
  id: string;
  number: string;
  kind: "rectify" | "cancel";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  icon: React.ReactNode;
}) {
  const t = useTranslations("Economia");
  const [open, setOpen] = useDialogParam(`${kind}-emitida:${id}`);
  const [state, formAction] = useActionState(action, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        {icon}
        {kind === "rectify" ? t("rectifyInvoiceAction") : t("cancelInvoiceAction")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "rectify"
              ? t("rectifyInvoiceTitle", { number })
              : t("cancelInvoiceTitle", { number })}
          </DialogTitle>
          <DialogDescription>
            {kind === "rectify" ? t("rectifyInvoiceDescription") : t("cancelInvoiceDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant={kind === "cancel" ? "destructive" : "default"}>
              {kind === "rectify" ? t("rectifyInvoiceAction") : t("cancelInvoiceAction")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
