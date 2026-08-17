"use client";

import { useActionState } from "react";
import { PaperclipIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  addSponsorshipTerm,
  updateSponsorshipTerm,
} from "@/app/[locale]/(app)/patrocinadores/actions";
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
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useFrozenWhileOpen } from "@/hooks/use-frozen-while-open";

const AGREEMENT_STATUSES = ["negotiating", "confirmed", "lost"] as const;

type SponsorshipTerm = {
  id: string;
  tier: string | null;
  agreementStatus: string;
  totalAmountCents: number | null;
  startsOn: string | null;
  endsOn: string | null;
  benefits: string | null;
  notes: string | null;
};

type SponsorshipTermDialogProps =
  | { mode: "create"; sponsorId: string }
  | { mode: "edit"; term: SponsorshipTerm; contractUrl: string | null };

export function SponsorshipTermDialog(props: SponsorshipTermDialogProps) {
  const t = useTranslations("Patrocinadores");
  const [open, setOpen] = useDialogParam(
    props.mode === "create"
      ? `patrocinio-nuevo:${props.sponsorId}`
      : `patrocinio:${props.term.id}`,
  );
  const [state, formAction] = useActionState(
    props.mode === "create" ? addSponsorshipTerm : updateSponsorshipTerm,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const term = useFrozenWhileOpen(open, props.mode === "edit" ? props.term : null);
  const contractUrl = useFrozenWhileOpen(
    open,
    props.mode === "edit" ? props.contractUrl : null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("addTermAction")}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <PencilIcon />
          <span className="sr-only">{t("editTermSr")}</span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("newTermTitle") : t("editTermTitle")}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {props.mode === "create" ? (
            <input type="hidden" name="sponsorId" value={props.sponsorId} />
          ) : (
            <input type="hidden" name="id" value={term!.id} />
          )}
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="term-tier">{t("tierLabel")}</FieldLabel>
                <Select name="tier" defaultValue={term?.tier ?? "none"}>
                  <SelectTrigger id="term-tier" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "none" ? t("tierNone") : t(`tier.${value}`)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("tierNone")}</SelectItem>
                    <SelectItem value="principal">{t("tier.principal")}</SelectItem>
                    <SelectItem value="colaborador">
                      {t("tier.colaborador")}
                    </SelectItem>
                    <SelectItem value="publicidad">{t("tier.publicidad")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="term-amount">{t("totalAmountLabel")}</FieldLabel>
                <Input
                  id="term-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="1500"
                  defaultValue={
                    term?.totalAmountCents != null
                      ? (term.totalAmountCents / 100).toString()
                      : ""
                  }
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="term-agreement-status">
                {t("agreementStatusLabel")}
              </FieldLabel>
              <Select
                name="agreementStatus"
                defaultValue={term?.agreementStatus ?? "confirmed"}
              >
                <SelectTrigger id="term-agreement-status" className="w-full">
                  <SelectValue>
                    {(value: string) => t(`agreementStatus.${value}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AGREEMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`agreementStatus.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="term-starts-on">{t("startsOnLabel")}</FieldLabel>
                <Input
                  id="term-starts-on"
                  name="startsOn"
                  type="date"
                  defaultValue={term?.startsOn ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="term-ends-on">{t("endsOnLabel")}</FieldLabel>
                <Input
                  id="term-ends-on"
                  name="endsOn"
                  type="date"
                  defaultValue={term?.endsOn ?? ""}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="term-benefits">{t("benefitsLabel")}</FieldLabel>
              <Textarea
                id="term-benefits"
                name="benefits"
                defaultValue={term?.benefits ?? ""}
                placeholder={t("benefitsPlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="term-contract">{t("contractLabel")}</FieldLabel>
              {contractUrl ? (
                <a
                  href={contractUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PaperclipIcon className="size-3.5" />
                  {t("viewContract")}
                </a>
              ) : null}
              <Input
                id="term-contract"
                name="contract"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
              {contractUrl ? (
                <Field orientation="horizontal" className="mt-1">
                  <Checkbox id="term-remove-contract" name="removeContract" />
                  <Label htmlFor="term-remove-contract" className="font-normal">
                    {t("removeContractLabel")}
                  </Label>
                </Field>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="term-notes">{t("notesLabel")}</FieldLabel>
              <Textarea
                id="term-notes"
                name="notes"
                defaultValue={term?.notes ?? ""}
              />
            </Field>
          </FieldGroup>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>
              {props.mode === "create" ? t("addTermAction") : t("saveChanges")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
