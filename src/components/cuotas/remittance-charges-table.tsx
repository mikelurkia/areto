"use client";

import { useTranslations } from "next-intl";

import { DeleteChargeDialog } from "@/components/cuotas/delete-charge-dialog";
import { MarkChargeCollectedButton } from "@/components/cuotas/mark-charge-collected-button";
import { MarkChargeReturnedDialog } from "@/components/cuotas/mark-charge-returned-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import { SEPA_CHARGE_TONE, type SepaChargeStatus } from "@/lib/sepa-charge-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ChargeRow = {
  id: string;
  payerName: string;
  subjectName: string;
  amountCents: number;
  status: SepaChargeStatus;
  rum: string;
  returnReason: string | null;
};

export function RemittanceChargesTable({
  charges,
  locale,
  canManage,
}: {
  charges: ChargeRow[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Cuotas");

  function formatAmount(amountCents: number) {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
      amountCents / 100,
    );
  }

  if (charges.length === 0) {
    return (
      <SectionPlaceholder
        size="compact"
        title={t("noChargesTitle")}
        description={t("noChargesDescription")}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colSubject")}</TableHead>
          <TableHead priority="secondary">{t("colPayer")}</TableHead>
          <TableHead priority="tertiary">{t("colRum")}</TableHead>
          <TableHead className="text-right">{t("colAmount")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
          <TableHead className="text-right">{t("colActions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {charges.map((charge) => (
          <TableRow key={charge.id}>
            <TableCell className="font-medium">{charge.subjectName}</TableCell>
            <TableCell priority="secondary">{charge.payerName}</TableCell>
            <TableCell priority="tertiary" className="text-muted-foreground">
              {charge.rum}
            </TableCell>
            <TableCell nowrap className="text-right font-medium">
              {formatAmount(charge.amountCents)}
            </TableCell>
            <TableCell>
              <StatusBadge
                tone={SEPA_CHARGE_TONE[charge.status]}
                label={t(`status.${charge.status}`)}
              />
              {charge.status === "returned" && charge.returnReason ? (
                <p className="mt-1 text-xs text-muted-foreground">{charge.returnReason}</p>
              ) : null}
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              {canManage && charge.status === "pending" ? (
                <>
                  <MarkChargeCollectedButton id={charge.id} />
                  <MarkChargeReturnedDialog id={charge.id} />
                  <DeleteChargeDialog id={charge.id} subject={charge.subjectName} />
                </>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
