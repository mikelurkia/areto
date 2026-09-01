import { getTranslations } from "next-intl/server";

import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import { SEPA_CHARGE_TONE, type SepaChargeStatus } from "@/lib/sepa-charge-status";
import { formatCents } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PersonChargeReturn = {
  id: string;
  returnedOn: string;
  returnReason: string | null;
  remittance: { id: string; messageId: string } | null;
};

export type PersonChargeRow = {
  id: string;
  periodKey: string;
  subjectName: string;
  amountCents: number;
  status: SepaChargeStatus;
  collectedOn: string | null;
  returnedOn: string | null;
  returnReason: string | null;
  remittance: { id: string; messageId: string } | null;
  returns: PersonChargeReturn[];
};

/** Cargos SEPA de una persona: como pagadora y/o como sujeto cobrado. Solo lectura. */
export async function PersonCuotasTable({
  charges,
  locale,
}: {
  charges: PersonChargeRow[];
  locale: string;
}) {
  const t = await getTranslations("Cuotas");
  const tPersonas = await getTranslations("Personas");
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (charges.length === 0) {
    return <SectionPlaceholder size="compact" title={tPersonas("noCuotasDescription")} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colSubject")}</TableHead>
          <TableHead priority="secondary">{t("colPeriod")}</TableHead>
          <TableHead className="text-right">{t("colAmount")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
          <TableHead priority="tertiary">{t("colRemittance")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {charges.map((charge) => {
          const lastReturn = charge.returns[0] ?? null;
          return (
            <TableRow key={charge.id}>
              <TableCell className="font-medium">{charge.subjectName}</TableCell>
              <TableCell priority="secondary">{charge.periodKey}</TableCell>
              <TableCell nowrap className="text-right font-medium">
                {formatCents(charge.amountCents, locale)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  tone={SEPA_CHARGE_TONE[charge.status]}
                  label={t(`status.${charge.status}`)}
                />
                {lastReturn ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lastReturn.remittance
                      ? t("returnedFromLabel", { messageId: lastReturn.remittance.messageId })
                      : t("returnedFromNoRemittanceLabel")}
                    {" · "}
                    {dateFmt.format(new Date(lastReturn.returnedOn))}
                    {lastReturn.returnReason ? ` · ${lastReturn.returnReason}` : ""}
                  </p>
                ) : null}
              </TableCell>
              <TableCell priority="tertiary">
                {charge.remittance ? (
                  <HoverPrefetchLink
                    href={`/cuotas/${charge.remittance.id}`}
                    className="hover:underline"
                  >
                    {charge.remittance.messageId}
                  </HoverPrefetchLink>
                ) : (
                  <span className="text-muted-foreground">{t("noRemittanceValue")}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
