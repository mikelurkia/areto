"use client";

import { useMemo, useState } from "react";
import { DownloadIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { downloadCsv } from "@/lib/csv";
import { usePathname } from "@/i18n/navigation";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { PrintButton } from "@/components/print-button";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Button } from "@/components/ui/button";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InvoiceRow = {
  id: string;
  sponsorId: string;
  invoiceNumber: string;
  invoicedOn: string | null;
  sponsorName: string;
  concept: string;
  amountCents: number;
};

export function InvoiceRegister({
  invoices,
  years,
  locale,
}: {
  invoices: InvoiceRow[];
  years: number[];
  locale: string;
}) {
  const t = useTranslations("Patrocinadores");
  const pathname = usePathname();
  const [year, setYear] = useState("all");

  function formatAmount(amountCents: number) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(amountCents / 100);
  }

  const filtered = useMemo(() => {
    if (year === "all") return invoices;
    return invoices.filter((inv) => (inv.invoicedOn ?? "").slice(0, 4) === year);
  }, [invoices, year]);

  const totalCents = useMemo(
    () => filtered.reduce((sum, inv) => sum + inv.amountCents, 0),
    [filtered],
  );

  function handleExportCsv() {
    const headers = [
      t("colInvoiceDate"),
      t("invoiceNumberLabel"),
      t("colSponsor"),
      t("conceptLabel"),
      t("colAmount"),
    ];
    const rows = filtered.map((inv) => [
      inv.invoicedOn ?? "",
      inv.invoiceNumber,
      inv.sponsorName,
      inv.concept,
      formatAmount(inv.amountCents),
    ]);
    downloadCsv(`libro-facturas${year === "all" ? "" : `-${year}`}.csv`, headers, rows);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select value={year} onValueChange={(v) => setYear(v ?? "all")}>
          <SelectTrigger aria-label={t("fiscalYearLabel")}>
            <SelectValue>
              {(value: string) =>
                value === "all" ? t("fiscalYearAll") : value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("fiscalYearAll")}</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {t("invoiceCount", { count: filtered.length })}
        </span>
        <div className="ml-auto flex gap-2">
          <PrintButton label={t("printAction")} />
          <Button variant="outline" onClick={handleExportCsv}>
            <DownloadIcon data-icon="inline-start" />
            {t("exportCsvAction")}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <SectionPlaceholder
          size="compact"
          title={t("noInvoicesTitle")}
          description={t("noInvoicesDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead priority="secondary">{t("colInvoiceDate")}</TableHead>
              <TableHead>{t("invoiceNumberLabel")}</TableHead>
              <TableHead>{t("colSponsor")}</TableHead>
              <TableHead priority="tertiary">{t("conceptLabel")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
              <TableHead className="text-right print:hidden">
                {t("colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell priority="secondary" nowrap>
                  {inv.invoicedOn ?? "—"}
                </TableCell>
                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell>
                  <HoverPrefetchLink
                    href={`/patrocinadores/${inv.sponsorId}?from=${encodeURIComponent(pathname)}&fromLabel=${encodeURIComponent(t("invoiceRegisterLink"))}`}
                    className="hover:underline"
                  >
                    {inv.sponsorName}
                  </HoverPrefetchLink>
                </TableCell>
                <TableCell priority="tertiary" className="text-muted-foreground">
                  {inv.concept}
                </TableCell>
                <TableCell nowrap className="text-right font-medium">
                  {formatAmount(inv.amountCents)}
                </TableCell>
                <TableCell className="flex justify-end print:hidden">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={
                      <HoverPrefetchLink
                        href={`/patrocinadores/${inv.sponsorId}/recibo/${inv.id}`}
                      />
                    }
                    nativeButton={false}
                  >
                    <ReceiptTextIcon />
                    <span className="sr-only">{t("viewInvoiceSr")}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              {/* Una celda por columna, sin `colSpan`: al ocultarse las de
                  prioridad el número de celdas debe seguir cuadrando. */}
              <TableCell priority="secondary" />
              <TableCell className="font-medium">
                {t("totalInvoicedLabel")}
              </TableCell>
              <TableCell />
              <TableCell priority="tertiary" />
              <TableCell nowrap className="text-right font-semibold">
                {formatAmount(totalCents)}
              </TableCell>
              <TableCell className="print:hidden" />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </>
  );
}
