import { ReceiptTextIcon } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { economicCategories, issuedInvoices, seasons } from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { IssuedInvoiceDialog } from "@/components/economia/issued-invoice-dialog";
import { IssuedInvoicesBrowser } from "@/components/economia/issued-invoices-browser";
import { SeasonSelect } from "@/components/equipos/season-select";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  canManageLedger,
  resolveLedger,
  visibleLedgers,
} from "@/lib/economia";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaEmitidas") };
}

export default async function EmitidasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string; season?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);

  const [query, allSeasons, categories] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
    db.query.economicCategories.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(economicCategories.sortOrder), asc(economicCategories.name)],
    }),
  ]);

  const ledger = resolveLedger(query[LEDGER_PARAM], visible)!;
  const canManage = canManageLedger(user, ledger);
  const season =
    allSeasons.find((s) => s.id === query.season) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const invoiceRows = season
    ? await db.query.issuedInvoices.findMany({
        where: and(eq(issuedInvoices.ledger, ledger), eq(issuedInvoices.seasonId, season.id)),
        orderBy: [desc(issuedInvoices.issuedOn), desc(issuedInvoices.number)],
      })
    : [];

  const rows = invoiceRows.map((i) => ({
    id: i.id,
    ledger: i.ledger,
    number: i.number,
    seasonId: i.seasonId,
    categoryId: i.categoryId,
    customerName: i.customerName,
    customerTaxId: i.customerTaxId,
    customerAddress: i.customerAddress,
    issuedOn: i.issuedOn,
    dueDate: i.dueDate,
    concept: i.concept,
    baseCents: i.baseCents,
    vatCents: i.vatCents,
    withholdingCents: i.withholdingCents,
    totalCents: i.totalCents,
    status: i.status,
    notes: i.notes,
  }));

  const seasonOptions = allSeasons.map((s) => ({ id: s.id, name: s.name }));
  const manageableLedgers = visible.filter((l) => canManageLedger(user, l));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("issuedInvoicesTitle")}
        description={t("issuedInvoicesSubtitle")}
        actions={
          <>
            <SeasonSelect
              seasons={allSeasons}
              selectedId={season?.id ?? ""}
              extraParams={visible.length > 1 ? { [LEDGER_PARAM]: ledger } : undefined}
            />
            {canManage && season ? (
              <IssuedInvoiceDialog
                mode="create"
                ledger={ledger}
                manageableLedgers={manageableLedgers}
                seasons={seasonOptions}
                categories={categories}
              />
            ) : null}
          </>
        }
      />
      <EconomiaSectionNav current="emitidas" ledger={ledger} visible={visible} />

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={ReceiptTextIcon}
          title={t("noIssuedInvoicesTitle")}
          description={t("noIssuedInvoicesDescription")}
        />
      ) : (
        <IssuedInvoicesBrowser
          invoices={rows}
          seasons={seasonOptions}
          categories={categories}
          ledger={ledger}
          seasonId={season!.id}
          manageableLedgers={manageableLedgers}
          locale={locale}
          canManage={canManage}
        />
      )}
    </div>
  );
}
