"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/hooks/use-action-toast";
import { RECONCILIATION_TONE, reconciliationState } from "@/lib/economia";
import { formatCents } from "@/lib/money";

export type MovementLinkRow = {
  id: string;
  movementId: string;
  amountCents: number;
  movementConcept: string;
  movementBookedOn: string;
};

export type CandidateMovement = { id: string; concept: string; bookedOn: string; amountCents: number };

/**
 * Qué documento se está conciliando. El panel es el mismo para recibidas y
 * emitidas: cambia el campo de `movement_links` que se rellena y la Server
 * Action que lo inserta, que llega por prop desde el Server Component.
 */
export type LinkTarget = {
  field: "receivedInvoiceId" | "issuedInvoiceId" | "sepaRemittanceId";
  id: string;
};

type LinkAction = (prev: EconomiaState, formData: FormData) => Promise<EconomiaState>;

function UnlinkButton({ id, unlinkAction }: { id: string; unlinkAction: LinkAction }) {
  const [state, action] = useActionState(unlinkAction, {});
  useActionToast(state);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="icon-sm">
        <Trash2Icon />
      </SubmitButton>
    </form>
  );
}

export function MovementLinksPanel({
  target,
  linkAction,
  unlinkAction,
  totalCents,
  links,
  candidates,
  locale,
  canManage,
}: {
  target: LinkTarget;
  linkAction: LinkAction;
  unlinkAction: LinkAction;
  totalCents: number;
  links: MovementLinkRow[];
  candidates: CandidateMovement[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Economia");
  const [state, action] = useActionState(linkAction, {});
  useActionToast(state);
  const [movementId, setMovementId] = useState(candidates[0]?.id ?? "");

  const linkedCents = links.reduce((sum, l) => sum + l.amountCents, 0);
  const reconciliation = reconciliationState(linkedCents, totalCents);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const formatDate = (value: string) => dateFmt.format(new Date(`${value}T00:00:00`));

  const remainingCents = totalCents - linkedCents;
  const suggestedAmount = remainingCents > 0 ? String(remainingCents / 100) : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("reconciliationLabel")}</span>
        <StatusBadge
          tone={RECONCILIATION_TONE[reconciliation]}
          label={t(`reconciliation_${reconciliation}`)}
        />
      </div>

      {links.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("bookedOnLabel")}</TableHead>
              <TableHead>{t("conceptLabel")}</TableHead>
              <TableHead className="text-right">{t("amountLabel")}</TableHead>
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell nowrap>{formatDate(link.movementBookedOn)}</TableCell>
                <TableCell>{link.movementConcept}</TableCell>
                <TableCell nowrap className="text-right font-medium">
                  {formatCents(link.amountCents, locale)}
                </TableCell>
                {canManage ? (
                  <TableCell>
                    <UnlinkButton id={link.id} unlinkAction={unlinkAction} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noLinksYet")}</p>
      )}

      {canManage && candidates.length > 0 ? (
        <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-3">
          <input type="hidden" name={target.field} value={target.id} />
          <FieldGroup className="flex flex-1 flex-wrap items-end gap-2">
            <Field className="min-w-48 flex-1">
              <FieldLabel htmlFor="link-movement">{t("linkMovementLabel")}</FieldLabel>
              <Select name="movementId" value={movementId} onValueChange={(v) => setMovementId(v ?? "")}>
                <SelectTrigger id="link-movement" className="w-full">
                  <SelectValue>
                    {(value: string) => {
                      const m = candidates.find((c) => c.id === value);
                      return m ? `${formatDate(m.bookedOn)} · ${m.concept}` : "";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {formatDate(m.bookedOn)} · {m.concept} ({formatCents(m.amountCents, locale)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-32">
              <FieldLabel htmlFor="link-amount">{t("amountLabel")}</FieldLabel>
              <Input
                id="link-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={suggestedAmount}
                required
              />
            </Field>
            <SubmitButton>{t("linkAction")}</SubmitButton>
          </FieldGroup>
        </form>
      ) : null}
      <FormError message={state.error} />
    </div>
  );
}
