import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { economicCategories, persons, purchaseReceipts, seasons, teams } from "@/db/schema";
import { EconomiaLedgerFilter } from "@/components/economia/economia-ledger-filter";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { PurchaseReceiptDialog } from "@/components/economia/purchase-receipt-dialog";
import { PurchaseReceiptsBrowser } from "@/components/economia/purchase-receipts-browser";
import { SeasonSelect } from "@/components/equipos/season-select";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  canManageLedger,
  ledgersForFilter,
  reconciliationState,
  resolveLedgerFilter,
  visibleLedgers,
} from "@/lib/economia";
import { requirePermission } from "@/lib/auth";
import { ReceiptTextIcon } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaTickets") };
}

export default async function TicketsPage({
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

  const [query, allSeasons, categories, personRows] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
    db.query.economicCategories.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(economicCategories.sortOrder), asc(economicCategories.name)],
    }),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true },
      orderBy: [asc(persons.lastName), asc(persons.firstName)],
    }),
  ]);

  const filter = resolveLedgerFilter(query[LEDGER_PARAM], visible)!;
  const ledgers = ledgersForFilter(filter, visible);
  const manageableLedgers = visible.filter((l) => canManageLedger(user, l));
  const canManage = manageableLedgers.length > 0;
  const navLedger = filter === "both" ? visible[0] : filter;
  const season =
    allSeasons.find((s) => s.id === query.season) ??
    allSeasons.find((s) => s.isCurrent) ??
    allSeasons[0];

  const receiptRows = season
    ? await db.query.purchaseReceipts.findMany({
        where: and(
          inArray(purchaseReceipts.ledger, ledgers),
          eq(purchaseReceipts.seasonId, season.id),
        ),
        orderBy: [desc(purchaseReceipts.purchasedOn), desc(purchaseReceipts.createdAt)],
        with: {
          paidByPerson: { columns: { firstName: true, lastName: true } },
          links: { columns: { amountCents: true } },
        },
      })
    : [];

  const teamRows = season
    ? await db.query.teams.findMany({
        where: eq(teams.seasonId, season.id),
        columns: { id: true, name: true },
        orderBy: [asc(teams.name)],
      })
    : [];

  const rows = receiptRows.map((r) => ({
    id: r.id,
    ledger: r.ledger,
    seasonId: r.seasonId,
    teamId: r.teamId,
    categoryId: r.categoryId,
    paidByPersonId: r.paidByPersonId,
    paidByName: r.paidByPerson
      ? `${r.paidByPerson.firstName} ${r.paidByPerson.lastName}`.trim()
      : "",
    purchasedOn: r.purchasedOn,
    description: r.description,
    totalCents: r.totalCents,
    notes: r.notes,
    reconciliation: reconciliationState(
      r.links.reduce((sum, l) => sum + l.amountCents, 0),
      r.totalCents,
    ),
  }));

  const seasonOptions = allSeasons.map((s) => ({ id: s.id, name: s.name }));
  const teamOptions = teamRows.map((tm) => ({ id: tm.id, name: tm.name }));
  const personOptions = personRows.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("ticketsTitle")}
        description={t("ticketsSubtitle")}
        actions={
          <>
            <SeasonSelect
              seasons={allSeasons}
              selectedId={season?.id ?? ""}
              extraParams={visible.length > 1 ? { [LEDGER_PARAM]: filter } : undefined}
            />
            {canManage && season ? (
              <PurchaseReceiptDialog
                mode="create"
                ledger={navLedger}
                manageableLedgers={manageableLedgers}
                seasons={seasonOptions}
                teams={teamOptions}
                categories={categories}
                personOptions={personOptions}
              />
            ) : null}
          </>
        }
      />
      <EconomiaSectionNav
        current="tickets"
        ledger={filter}
        visible={visible}
        ledgerFilterSlot={
          <EconomiaLedgerFilter href="/economia/tickets" filter={filter} visible={visible} />
        }
      />

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={ReceiptTextIcon}
          title={t("noTicketsTitle")}
          description={t("noTicketsDescription")}
        />
      ) : (
        <PurchaseReceiptsBrowser
          receipts={rows}
          seasons={seasonOptions}
          teams={teamOptions}
          categories={categories}
          personOptions={personOptions}
          filter={filter}
          manageableLedgers={manageableLedgers}
          locale={locale}
        />
      )}
    </div>
  );
}
