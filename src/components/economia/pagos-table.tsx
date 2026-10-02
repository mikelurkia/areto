"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import type { EconomiaState } from "@/app/[locale]/(app)/economia/cuentas/actions";
import { BulkActionsBar } from "@/components/bulk-actions-bar";
import { EmptyValue } from "@/components/empty-value";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { MarkPurchaseReceiptPaidButton } from "@/components/economia/mark-purchase-receipt-paid-button";
import { MaskedIbanText } from "@/components/masked-iban";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";
import { useRowSelection } from "@/hooks/use-row-selection";
import { RECONCILIATION_TONE, type Ledger, type reconciliationState } from "@/lib/economia";
import { formatCents } from "@/lib/money";

type MarkAction = (prev: EconomiaState, formData: FormData) => Promise<EconomiaState>;

export type PagosRow = {
  id: string;
  kind: "invoice" | "receipt";
  ledger: Ledger;
  beneficiary: string;
  iban: string | null;
  totalCents: number;
  dueDate: string | null;
  reconciliation: ReturnType<typeof reconciliationState>;
  canManage: boolean;
  href: string;
};

export function PagosTable({
  rows,
  locale,
  showLedgerColumn,
  markAction,
  unmarkAction,
  bulkMarkAction,
}: {
  rows: PagosRow[];
  locale: string;
  showLedgerColumn: boolean;
  markAction: MarkAction;
  unmarkAction: MarkAction;
  bulkMarkAction: MarkAction;
}) {
  const t = useTranslations("Economia");
  const selectableRows = rows.filter((r) => r.kind === "receipt" && r.canManage);
  const { selectedIds, setSelectedIds, allPageSelected, toggleSelected, toggleSelectAll } =
    useRowSelection(selectableRows);
  const [bulkState, bulkFormAction] = useActionState(bulkMarkAction, {});
  useActionToast(bulkState);
  useActionResult(bulkState, (result) => {
    if (result.message) setSelectedIds(new Set());
  });

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const formatDate = (value: string) => dateFmt.format(new Date(`${value}T00:00:00`));

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.size > 0 ? (
        <BulkActionsBar
          countLabel={t("bulkSelectedCount", { count: selectedIds.size })}
          clearLabel={t("bulkClearSelection")}
          onClear={() => setSelectedIds(new Set())}
        >
          <form action={bulkFormAction}>
            {[...selectedIds].map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <SubmitButton size="sm">{t("bulkMarkPaidAction")}</SubmitButton>
          </form>
        </BulkActionsBar>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            {selectableRows.length > 0 ? (
              <TableHead className="w-8">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  aria-label={t("bulkSelectAllSr")}
                />
              </TableHead>
            ) : null}
            <TableHead>{t("pendingPaymentBeneficiaryLabel")}</TableHead>
            <TableHead priority="secondary">{t("accountIbanLabel")}</TableHead>
            <TableHead className="text-right">{t("invoiceTotalLabel")}</TableHead>
            <TableHead priority="secondary">{t("invoiceDueDateLabel")}</TableHead>
            <TableHead priority="secondary">{t("reconciliationLabel")}</TableHead>
            {showLedgerColumn ? <TableHead priority="tertiary" /> : null}
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const selectable = r.kind === "receipt" && r.canManage;
            return (
              <TableRow key={`${r.kind}-${r.id}`}>
                {selectableRows.length > 0 ? (
                  <TableCell>
                    {selectable ? (
                      <Checkbox
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={(checked) => toggleSelected(r.id, checked === true)}
                        aria-label={t("bulkSelectRowSr", { name: r.beneficiary })}
                      />
                    ) : null}
                  </TableCell>
                ) : null}
                <TableCell className="font-medium">
                  <HoverPrefetchLink href={r.href} className="hover:underline">
                    {r.beneficiary || <EmptyValue />}
                  </HoverPrefetchLink>
                </TableCell>
                <TableCell priority="secondary">
                  {r.iban ? <MaskedIbanText value={r.iban} /> : <EmptyValue />}
                </TableCell>
                <TableCell nowrap className="text-right font-medium">
                  {formatCents(r.totalCents, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap>
                  {r.dueDate ? formatDate(r.dueDate) : <EmptyValue />}
                </TableCell>
                <TableCell priority="secondary">
                  <StatusBadge
                    tone={RECONCILIATION_TONE[r.reconciliation]}
                    label={t(`reconciliation_${r.reconciliation}`)}
                  />
                </TableCell>
                {showLedgerColumn ? (
                  <TableCell priority="tertiary">
                    <StatusBadge tone="neutral" label={t(`ledger_${r.ledger}`)} />
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  {selectable ? (
                    <MarkPurchaseReceiptPaidButton
                      id={r.id}
                      paid={false}
                      markAction={markAction}
                      unmarkAction={unmarkAction}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
