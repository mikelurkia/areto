import { FileTextIcon, ReceiptTextIcon } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { economicCategories, receivedInvoices, seasons, suppliers, teams } from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { ReceivedInvoiceDialog } from "@/components/economia/received-invoice-dialog";
import { ReceivedInvoicesBrowser } from "@/components/economia/received-invoices-browser";
import { SeasonSelect } from "@/components/equipos/season-select";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
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
  return { title: t("economiaRecibidas") };
}

export default async function RecibidasPage({
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

  const [query, allSeasons, supplierRows, categories] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
    db.query.suppliers.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(suppliers.name)],
    }),
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
    ? await db.query.receivedInvoices.findMany({
        where: and(eq(receivedInvoices.ledger, ledger), eq(receivedInvoices.seasonId, season.id)),
        orderBy: [desc(receivedInvoices.issuedOn), desc(receivedInvoices.createdAt)],
        with: { supplier: { columns: { name: true } } },
      })
    : [];

  const teamRows = season
    ? await db.query.teams.findMany({
        where: eq(teams.seasonId, season.id),
        columns: { id: true, name: true },
        orderBy: [asc(teams.name)],
      })
    : [];

  const rows = invoiceRows.map((i) => ({
    id: i.id,
    ledger: i.ledger,
    supplierId: i.supplierId,
    supplierName: i.supplier.name,
    seasonId: i.seasonId,
    teamId: i.teamId,
    categoryId: i.categoryId,
    invoiceNumber: i.invoiceNumber,
    issuedOn: i.issuedOn,
    dueDate: i.dueDate,
    baseCents: i.baseCents,
    vatCents: i.vatCents,
    withholdingCents: i.withholdingCents,
    totalCents: i.totalCents,
    status: i.status,
    description: i.description,
    notes: i.notes,
  }));

  const seasonOptions = allSeasons.map((s) => ({ id: s.id, name: s.name }));
  const teamOptions = teamRows.map((tm) => ({ id: tm.id, name: tm.name }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("receivedInvoicesTitle")}
        description={t("receivedInvoicesSubtitle")}
        actions={
          <>
            <SeasonSelect
              seasons={allSeasons}
              selectedId={season?.id ?? ""}
              extraParams={visible.length > 1 ? { [LEDGER_PARAM]: ledger } : undefined}
            />
            {canManage && season ? (
              <ReceivedInvoiceDialog
                mode="create"
                ledger={ledger}
                manageableLedgers={visible.filter((l) => canManageLedger(user, l))}
                suppliers={supplierRows}
                seasons={seasonOptions}
                teams={teamOptions}
                categories={categories}
              />
            ) : null}
          </>
        }
      />
      <EconomiaSectionNav current="recibidas" ledger={ledger} visible={visible} />

      {supplierRows.length === 0 ? (
        <SectionPlaceholder
          icon={FileTextIcon}
          title={t("noSuppliersForInvoicesTitle")}
          description={t("noSuppliersForInvoicesDescription")}
        >
          {canManage ? (
            <Button render={<Link href="/economia/proveedores" />} nativeButton={false}>
              {t("goToSuppliers")}
            </Button>
          ) : null}
        </SectionPlaceholder>
      ) : rows.length === 0 ? (
        <SectionPlaceholder
          icon={ReceiptTextIcon}
          title={t("noInvoicesTitle")}
          description={t("noInvoicesDescription")}
        />
      ) : (
        <ReceivedInvoicesBrowser
          invoices={rows}
          suppliers={supplierRows}
          seasons={seasonOptions}
          teams={teamOptions}
          categories={categories}
          ledger={ledger}
          seasonId={season!.id}
          manageableLedgers={visible.filter((l) => canManageLedger(user, l))}
          locale={locale}
          canManage={canManage}
        />
      )}
    </div>
  );
}
