"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangleIcon, InfoIcon, LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { FormError } from "@/components/form-error";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import {
  RECONCILIATION_TONE,
  checkMovementLink,
  expectedMovementSign,
  reconciliationState,
  sortByAmountProximity,
} from "@/lib/economia";
import { formatCents, readAmountCents } from "@/lib/money";

/** Un documento enlazable desde el listado de apuntes, con lo que ya lleva conciliado. */
export type LinkCandidate = {
  kind: "received" | "issued" | "receipt";
  id: string;
  number: string;
  totalCents: number;
  /** Suma de los enlaces que el documento ya tiene. */
  linkedCents: number;
  label: string;
};

type LinkAction = (prev: EconomiaState, formData: FormData) => Promise<EconomiaState>;

const FIELD_BY_KIND = {
  received: "receivedInvoiceId",
  issued: "issuedInvoiceId",
  receipt: "purchaseReceiptId",
} as const;

const GROUP_KEY_BY_KIND = {
  received: "linkGroupReceived",
  issued: "linkGroupIssued",
  receipt: "linkGroupReceipt",
} as const;

const remainingOf = (c: LinkCandidate) =>
  Math.max(0, Math.abs(c.totalCents) - Math.abs(c.linkedCents));

const labelOf = (c: LinkCandidate) => [c.number, c.label].filter(Boolean).join(" · ");

function LinkInvoiceForm({
  movementId,
  movementAmountCents,
  movementLinkedCents,
  candidate,
  setCandidate,
  items,
  actionByKind,
  locale,
  setOpen,
}: {
  movementId: string;
  movementAmountCents: number;
  movementLinkedCents: number;
  candidate: LinkCandidate | null;
  setCandidate: (value: LinkCandidate | null) => void;
  items: LinkCandidate[];
  actionByKind: Record<LinkCandidate["kind"], LinkAction>;
  locale: string;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Economia");
  const kind = candidate?.kind ?? "received";
  const [state, formAction] = useActionState(actionByKind[kind], {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const movementRemainingCents = Math.max(
    0,
    Math.abs(movementAmountCents) - Math.abs(movementLinkedCents),
  );
  const documentRemainingCents = candidate ? remainingOf(candidate) : 0;

  // El importe va en estado, no en `defaultValue`: las tres casillas de cuadre
  // y el aviso se recalculan con cada tecla, y esa diferencia es justo el dato
  // que antes no se veía en ninguna parte.
  // El inicializador contempla que ya haya documento elegido: el formulario se
  // remonta (`key`) al cambiar de tipo de documento, y sin esto el importe
  // volvería al del apunte entero justo después de elegir.
  const [amount, setAmount] = useState(() =>
    String((candidate ? Math.min(movementRemainingCents, documentRemainingCents) : movementRemainingCents) / 100),
  );
  const [inputValue, setInputValue] = useState(() => (candidate ? labelOf(candidate) : ""));

  const amountCents = readAmountCents(amount) ?? 0;
  const check = checkMovementLink({
    kind,
    amountCents,
    movementAmountCents,
    movementLinkedCents,
    documentTotalCents: candidate?.totalCents ?? 0,
    documentLinkedCents: candidate?.linkedCents ?? 0,
  });
  const differenceCents = documentRemainingCents - Math.abs(amountCents);

  function chooseCandidate(value: LinkCandidate | null) {
    setCandidate(value);
    if (value) setAmount(String(Math.min(movementRemainingCents, remainingOf(value)) / 100));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="movementId" value={movementId} />
      {candidate ? (
        <input type="hidden" name={FIELD_BY_KIND[candidate.kind]} value={candidate.id} />
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="link-invoice-select">{t("linkDocumentLabel")}</FieldLabel>
          <Combobox<LinkCandidate>
            items={items}
            value={candidate}
            onValueChange={chooseCandidate}
            inputValue={inputValue}
            onInputValueChange={setInputValue}
            itemToStringLabel={labelOf}
            isItemEqualToValue={(a, b) => a.id === b.id}
          >
            <ComboboxInput
              id="link-invoice-select"
              className="w-full"
              placeholder={t("linkDocumentSearchPlaceholder")}
              showClear
            />
            <ComboboxContent>
              <ComboboxEmpty>{t("linkDocumentEmpty")}</ComboboxEmpty>
              <ComboboxList>
                {(item: LinkCandidate) => (
                  <ComboboxItem key={item.id} value={item}>
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{labelOf(item)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(GROUP_KEY_BY_KIND[item.kind])}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end tabular-nums">
                        <span>{formatCents(item.totalCents, locale)}</span>
                        {item.linkedCents !== 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t("linkDocumentPendingHint", {
                              amount: formatCents(remainingOf(item), locale),
                            })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
      </FieldGroup>

      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label={t("linkMovementAmountLabel")}
          value={<span className="tabular-nums">{formatCents(movementAmountCents, locale)}</span>}
        />
        <StatTile
          label={t("linkDocumentRemainingLabel")}
          value={
            <span className="tabular-nums">
              {candidate ? formatCents(documentRemainingCents, locale) : "—"}
            </span>
          }
        />
        <StatTile
          label={t("linkDifferenceLabel")}
          value={
            <span className="tabular-nums">
              {candidate ? formatCents(differenceCents, locale) : "—"}
            </span>
          }
          tone={!candidate ? "neutral" : check.error ? "danger" : check.settles ? "positive" : "warning"}
        />
      </div>

      {candidate && check.error ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertDescription>{t(`linkError_${check.error}`)}</AlertDescription>
        </Alert>
      ) : candidate && amountCents > 0 && !check.settles ? (
        <Alert variant="warning">
          <InfoIcon />
          <AlertDescription>
            {t("linkAmountPartialLabel", { amount: formatCents(differenceCents, locale) })}
          </AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="link-invoice-amount">{t("amountLabel")}</FieldLabel>
          <Input
            id="link-invoice-amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="link-invoice-file">{t("receiptFileLabel")}</FieldLabel>
          <Input id="link-invoice-file" name="file" type="file" />
        </Field>
        <SubmitButton disabled={!candidate || check.error !== null}>{t("linkAction")}</SubmitButton>
      </FieldGroup>
      <FormError message={state.error} />
    </form>
  );
}

export function LinkInvoiceDialog({
  movementId,
  amountCents,
  linkedCents,
  bookedOn,
  concept,
  counterparty,
  candidates,
  linkReceivedInvoiceAction,
  linkIssuedInvoiceAction,
  linkPurchaseReceiptAction,
  locale,
}: {
  movementId: string;
  amountCents: number;
  linkedCents: number;
  bookedOn: string;
  concept: string;
  counterparty: string | null;
  candidates: LinkCandidate[];
  linkReceivedInvoiceAction: LinkAction;
  linkIssuedInvoiceAction: LinkAction;
  linkPurchaseReceiptAction: LinkAction;
  locale: string;
}) {
  const t = useTranslations("Economia");
  const [open, setOpen] = useDialogParam(`vincular:${movementId}`);
  const [candidate, setCandidate] = useState<LinkCandidate | null>(null);

  const sign = Math.sign(amountCents);
  const remainingCents = Math.max(0, Math.abs(amountCents) - Math.abs(linkedCents));
  const reconciliation = reconciliationState(linkedCents, amountCents);

  // El signo del apunte decide qué tipos de documento tienen sentido, y por eso
  // ya no hay un selector de "tipo de factura" que rellenar antes de buscar.
  // Dentro, lo más cercano a lo que queda por imputar va primero.
  const items = useMemo(
    () =>
      sortByAmountProximity(
        candidates.filter((c) => expectedMovementSign(c.kind) === sign),
        remainingCents,
        remainingOf,
        (c) => c.number,
      ),
    [candidates, sign, remainingCents],
  );

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <LinkIcon />
        <span className="sr-only">{t("linkInvoiceFromMovementSr")}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("linkInvoiceFromMovementTitle")}</DialogTitle>
        </DialogHeader>

        <Card size="sm">
          <CardContent className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{concept}</span>
              <span className="text-xs text-muted-foreground">
                {dateFmt.format(new Date(`${bookedOn}T00:00:00`))}
                {counterparty ? ` · ${counterparty}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-heading tabular-nums">{formatCents(amountCents, locale)}</span>
              {linkedCents !== 0 ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t("linkMovementUnallocatedLabel", {
                      amount: formatCents(remainingCents, locale),
                    })}
                  </span>
                  <StatusBadge
                    tone={RECONCILIATION_TONE[reconciliation]}
                    label={t(`reconciliation_${reconciliation}`)}
                  />
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("linkNoCandidates")}</p>
        ) : (
          <LinkInvoiceForm
            key={candidate?.kind ?? "none"}
            movementId={movementId}
            movementAmountCents={amountCents}
            movementLinkedCents={linkedCents}
            candidate={candidate}
            setCandidate={setCandidate}
            items={items}
            actionByKind={{
              received: linkReceivedInvoiceAction,
              issued: linkIssuedInvoiceAction,
              receipt: linkPurchaseReceiptAction,
            }}
            locale={locale}
            setOpen={setOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
