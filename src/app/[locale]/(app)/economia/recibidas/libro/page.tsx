import { Suspense } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { receivedInvoices, seasons, suppliers } from "@/db/schema";
import { BackLink } from "@/components/back-link";
import { EMPTY } from "@/components/empty-value";
import { PrintButton } from "@/components/print-button";
import { PrintableSheet } from "@/components/printable-sheet";
import { PrintableSheetBodySkeleton } from "@/components/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  canViewLedger,
  resolveLedger,
  visibleLedgers,
  type Ledger,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";
import type { CurrentUser } from "@/lib/auth";

type SearchParams = {
  libro?: string;
  season?: string;
  proveedor?: string;
  estado?: string;
  q?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaRecibidasLibro") };
}

/**
 * En su propio componente para poder darle un `<Suspense>`: depende de la
 * fecha de generación (reloj de la petición) y de los filtros de la URL, así
 * que no se puede prerenderizar (ver `next-prerender-current-time`).
 */
async function ReceivedInvoicesDocument({
  user,
  locale,
  searchParams,
}: {
  user: CurrentUser;
  locale: string;
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const t = await getTranslations("Economia");
  const visible = visibleLedgers(user);
  const query = await searchParams;
  const ledger = resolveLedger(query[LEDGER_PARAM], visible) as Ledger | null;
  if (!ledger || !canViewLedger(user, ledger)) notFound();

  const [allSeasons, supplierRows, club] = await Promise.all([
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
    db.query.suppliers.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(suppliers.name)],
    }),
    getClubSettings(),
  ]);

  const season =
    allSeasons.find((s) => s.id === query.season) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const invoiceRows = season
    ? await db.query.receivedInvoices.findMany({
        where: and(eq(receivedInvoices.ledger, ledger), eq(receivedInvoices.seasonId, season.id)),
        orderBy: [desc(receivedInvoices.issuedOn), desc(receivedInvoices.createdAt)],
        with: { supplier: { columns: { name: true } } },
      })
    : [];

  const supplierFilter = query.proveedor && query.proveedor !== "all" ? query.proveedor : null;
  const statusFilter = query.estado && query.estado !== "all" ? query.estado : null;
  const needle = query.q?.trim().toLowerCase() ?? "";

  let rows = invoiceRows;
  if (supplierFilter) rows = rows.filter((i) => i.supplierId === supplierFilter);
  if (statusFilter) rows = rows.filter((i) => i.status === statusFilter);
  if (needle) {
    rows = rows.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(needle) ||
        i.supplier.name.toLowerCase().includes(needle) ||
        (i.description?.toLowerCase().includes(needle) ?? false),
    );
  }

  const supplierLabel = supplierFilter
    ? (supplierRows.find((s) => s.id === supplierFilter)?.name ?? "")
    : t("filterSupplierAll");
  const statusLabel = statusFilter
    ? t(`invoiceStatus_${statusFilter}` as "invoiceStatus_pending")
    : null;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const fmtDate = (value: string | null) => (value ? dateFmt.format(new Date(`${value}T00:00:00`)) : EMPTY);

  const total = rows.reduce((sum, i) => sum + i.totalCents, 0);

  return (
    <PrintableSheet>
      <div className="flex items-start justify-between gap-6 border-b pb-[9pt]">
        <div>
          <h1 className="text-[11pt] font-semibold tracking-tight">{t("receivedInvoicesLibroTitle")}</h1>
          <p className="text-[8pt] text-muted-foreground">{club?.legalName ?? "Areto"}</p>
        </div>
        <div className="text-right text-[8pt]">
          {season ? <p className="font-medium">{season.name}</p> : null}
          <p className="text-muted-foreground">{t(`ledger_${ledger}`)}</p>
          <p className="text-muted-foreground">
            {t("invoiceSupplierLabel")}: {supplierLabel}
          </p>
          {statusLabel ? (
            <p className="text-muted-foreground">
              {t("invoiceStatusLabel")}: {statusLabel}
            </p>
          ) : null}
          {needle ? (
            <p className="text-muted-foreground">
              {t("listSearchLabel")}: {needle}
            </p>
          ) : null}
          <p className="mt-1 text-[7pt] text-muted-foreground">
            {t("listGeneratedOn", { date: dateFmt.format(new Date()) })}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-[8pt] text-muted-foreground">{t("noInvoiceResultsDescription")}</p>
      ) : (
        <>
          <Table className="table-fixed text-[8pt] [&_td]:px-[3pt] [&_td]:py-[1.5pt] [&_th]:px-[3pt] [&_th]:py-[1.5pt] [&_th]:break-words">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[13%]">{t("invoiceNumberLabel")}</TableHead>
                <TableHead className="w-[22%]">{t("invoiceSupplierLabel")}</TableHead>
                <TableHead className="w-[10%]">{t("invoiceIssuedOnLabel")}</TableHead>
                <TableHead className="w-[10%]">{t("invoiceDueDateLabel")}</TableHead>
                <TableHead className="w-[11%] text-right">{t("invoiceBaseLabel")}</TableHead>
                <TableHead className="w-[10%] text-right">{t("invoiceVatLabel")}</TableHead>
                <TableHead className="w-[12%] text-right">{t("invoiceTotalLabel")}</TableHead>
                <TableHead className="w-[12%]">{t("invoiceStatusLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell nowrap className="align-top font-medium">
                    {i.invoiceNumber}
                  </TableCell>
                  <TableCell className="align-top">{i.supplier.name}</TableCell>
                  <TableCell nowrap className="align-top">
                    {fmtDate(i.issuedOn)}
                  </TableCell>
                  <TableCell nowrap className="align-top">
                    {fmtDate(i.dueDate)}
                  </TableCell>
                  <TableCell nowrap className="align-top text-right">
                    {formatCents(i.baseCents, locale)}
                  </TableCell>
                  <TableCell nowrap className="align-top text-right">
                    {formatCents(i.vatCents, locale)}
                  </TableCell>
                  <TableCell nowrap className="align-top text-right font-medium">
                    {formatCents(i.totalCents, locale)}
                  </TableCell>
                  <TableCell className="align-top">{t(`invoiceStatus_${i.status}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-[6pt] text-right text-[8pt] font-semibold">
            {t("invoiceTotalLabel")}: {formatCents(total, locale)}
          </p>
        </>
      )}
    </PrintableSheet>
  );
}

/**
 * Listado imprimible de facturas recibidas: mismos filtros que la pantalla
 * (`recibidas/received-invoices-browser.tsx`), reproducidos en servidor desde
 * la URL para que lo que se ve al imprimir sea lo que se filtró en pantalla.
 */
export default async function RecibidasLibroPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href="/economia/recibidas" label={t("backToInvoices")} />
        <PrintButton label={t("printAction")} />
      </div>

      <Suspense
        fallback={
          <PrintableSheet>
            <PrintableSheetBodySkeleton lines={16} />
          </PrintableSheet>
        }
      >
        <ReceivedInvoicesDocument user={user} locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
