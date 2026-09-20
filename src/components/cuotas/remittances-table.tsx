"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { DeleteRemittanceDialog } from "@/components/cuotas/delete-remittance-dialog";
import { DownloadRemittanceXmlButton } from "@/components/cuotas/download-remittance-xml-button";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { formatCents } from "@/lib/money";

type RemittanceRow = {
  id: string;
  messageId: string;
  collectionDate: string;
  subject: string;
  chargeCount: number;
  totalCents: number;
};

export function RemittancesTable({
  remittances,
  locale,
  canManage,
}: {
  remittances: RemittanceRow[];
  locale: string;
  canManage: boolean;
}) {
  const t = useTranslations("Cuotas");
  const { page, pageCount, setPage, pageRows } = usePagedRows(remittances);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colSubject")}</TableHead>
            <TableHead priority="secondary">{t("colMessageId")}</TableHead>
            <TableHead priority="tertiary">{t("colCollectionDate")}</TableHead>
            <TableHead className="text-right">{t("colChargeCount")}</TableHead>
            <TableHead className="text-right">{t("colAmount")}</TableHead>
            <TableHead className="text-right">{t("colActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((remittance) => (
            <TableRow key={remittance.id}>
              <TableCell className="font-medium">
                <Link href={`/cuotas/${remittance.id}`} className="hover:underline">
                  {remittance.subject}
                </Link>
              </TableCell>
              <TableCell priority="secondary" className="text-muted-foreground">
                {remittance.messageId}
              </TableCell>
              <TableCell priority="tertiary" nowrap>
                {remittance.collectionDate}
              </TableCell>
              <TableCell className="text-right">{remittance.chargeCount}</TableCell>
              <TableCell nowrap className="text-right font-medium">
                {formatCents(remittance.totalCents, locale)}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <DownloadRemittanceXmlButton remittanceId={remittance.id} />
                {canManage ? (
                  <DeleteRemittanceDialog id={remittance.id} messageId={remittance.messageId} />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar page={page} pageCount={pageCount} onPageChange={setPage} />
    </>
  );
}
