"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  linkMovementToInvoice,
  unlinkMovement,
} from "@/app/[locale]/(app)/economia/recibidas/actions";
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
import { formatCents } from "@/lib/money";
import type { StatusTone } from "@/lib/status-tone";

export type MovementLinkRow = {
  id: string;
  movementId: string;
  amountCents: number;
  movementConcept: string;
  movementBookedOn: string;
};

export type CandidateMovement = { id: string; concept: string; bookedOn: string; amountCents: number };

const RECONCILIATION_TONE: Record<"pending" | "partial" | "settled", StatusTone> = {
  pending: "neutral",
  partial: "warning",
  settled: "positive",
};

function UnlinkButton({ id }: { id: string }) {
  const [state, action] = useActionState(unlinkMovement, {});
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
  receivedInvoiceId,
  totalCents,
  links,
  candidates,
  locale,
  canManage,
}: {
  receivedInvoiceId: string;
  totalCents: number;
  links: MovementLinkRow[];
  candidates: CandidateMovement[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Economia");
  const [state, action] = useActionState(linkMovementToInvoice, {});
  useActionToast(state);
  const [movementId, setMovementId] = useState(candidates[0]?.id ?? "");

  const linkedCents = links.reduce((sum, l) => sum + l.amountCents, 0);
  const reconciliation =
    linkedCents <= 0 ? "pending" : linkedCents >= totalCents ? "settled" : "partial";

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
                    <UnlinkButton id={link.id} />
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
          <input type="hidden" name="receivedInvoiceId" value={receivedInvoiceId} />
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
