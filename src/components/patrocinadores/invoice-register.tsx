"use client";

import { useMemo, useState } from "react";
import { DownloadIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
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

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

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
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `libro-facturas${year === "all" ? "" : `-${year}`}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
          icon={ReceiptTextIcon}
          title={t("noInvoicesTitle")}
          description={t("noInvoicesDescription")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colInvoiceDate")}</TableHead>
              <TableHead>{t("invoiceNumberLabel")}</TableHead>
              <TableHead>{t("colSponsor")}</TableHead>
              <TableHead>{t("conceptLabel")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
              <TableHead className="text-right print:hidden">
                {t("colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="whitespace-nowrap">
                  {inv.invoicedOn ?? "—"}
                </TableCell>
                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell>
                  <Link
                    href={`/patrocinadores/${inv.sponsorId}`}
                    className="hover:underline"
                  >
                    {inv.sponsorName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.concept}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(inv.amountCents)}
                </TableCell>
                <TableCell className="flex justify-end print:hidden">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={
                      <Link
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
              <TableCell colSpan={4} className="font-medium">
                {t("totalInvoicedLabel")}
              </TableCell>
              <TableCell className="text-right font-semibold">
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
