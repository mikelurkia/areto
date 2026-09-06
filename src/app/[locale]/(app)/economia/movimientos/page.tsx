import { ArrowLeftRightIcon, LandmarkIcon, UploadIcon } from "lucide-react";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import {
  accountMovements,
  economicCategories,
  financialAccounts,
  issuedInvoices,
  receivedInvoices,
  seasons,
} from "@/db/schema";
import { linkMovementToInvoice } from "@/app/[locale]/(app)/economia/recibidas/actions";
import { linkMovementToIssuedInvoice } from "@/app/[locale]/(app)/economia/emitidas/actions";
import { EconomiaLedgerFilter } from "@/components/economia/economia-ledger-filter";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { MovementDialog } from "@/components/economia/movement-dialog";
import { MovementsBrowser } from "@/components/economia/movements-browser";
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
  ledgersForFilter,
  resolveLedgerFilter,
  visibleLedgers,
} from "@/lib/economia";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaMovimientos") };
}

export default async function MovimientosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string; season?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);

  // Tres queries directas y el parámetro de la URL: nada de esto depende de lo
  // otro. Los apuntes sí (necesitan libro y temporada), y van aparte.
  const [query, allSeasons, categories] = await Promise.all([
    searchParams,
    db.query.seasons.findMany({ orderBy: desc(seasons.name) }),
    db.query.economicCategories.findMany({
      columns: { id: true, name: true, kind: true, isActive: true },
      orderBy: [
        asc(economicCategories.kind),
        asc(economicCategories.sortOrder),
        asc(economicCategories.name),
      ],
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

  // El filtro por libro va en el `where`, nunca en el render: pedir
  // `?libro=internal` sin el permiso cae en el libro oficial y no trae ni una
  // fila del otro. La temporada acota el volumen para poder filtrar en cliente.
  const movements = season
    ? await db.query.accountMovements.findMany({
        where: and(
          inArray(accountMovements.ledger, ledgers),
          eq(accountMovements.seasonId, season.id),
        ),
        orderBy: [desc(accountMovements.bookedOn), desc(accountMovements.createdAt)],
        with: {
          account: { columns: { name: true } },
          category: { columns: { name: true } },
          links: {
            columns: { amountCents: true },
            with: {
              receivedInvoice: { columns: { id: true, invoiceNumber: true } },
              issuedInvoice: { columns: { id: true, number: true } },
            },
          },
        },
      })
    : [];

  const accounts = await db.query.financialAccounts.findMany({
    where: inArray(financialAccounts.ledger, ledgers),
    columns: { id: true, name: true, isActive: true, ledger: true },
    orderBy: [asc(financialAccounts.name)],
  });

  // Aparte del resto: alimenta el diálogo de "vincular factura" desde el
  // listado de movimientos, no la carga inicial de la página.
  const [candidateReceivedInvoices, candidateIssuedInvoices] = season
    ? await Promise.all([
        db.query.receivedInvoices.findMany({
          where: and(
            inArray(receivedInvoices.ledger, ledgers),
            eq(receivedInvoices.seasonId, season.id),
          ),
          columns: { id: true, invoiceNumber: true, totalCents: true, ledger: true },
          with: { supplier: { columns: { name: true } } },
        }),
        db.query.issuedInvoices.findMany({
          where: and(
            inArray(issuedInvoices.ledger, ledgers),
            eq(issuedInvoices.seasonId, season.id),
          ),
          columns: { id: true, number: true, totalCents: true, ledger: true, customerName: true },
        }),
      ])
    : [[], []];

  const rows = movements.map((m) => ({
    id: m.id,
    ledger: m.ledger,
    accountId: m.accountId,
    accountName: m.account.name,
    seasonId: m.seasonId,
    bookedOn: m.bookedOn,
    valueOn: m.valueOn,
    amountCents: m.amountCents,
    concept: m.concept,
    counterparty: m.counterparty,
    balanceCents: m.balanceCents,
    categoryId: m.categoryId,
    categoryName: m.category?.name ?? null,
    source: m.source,
    notes: m.notes,
    linkedCents: m.links.reduce((sum, l) => sum + l.amountCents, 0),
    invoiceLinks: m.links.flatMap(
      (l): { kind: "received" | "issued"; id: string; number: string }[] =>
        l.receivedInvoice
          ? [{ kind: "received", id: l.receivedInvoice.id, number: l.receivedInvoice.invoiceNumber }]
          : l.issuedInvoice
            ? [{ kind: "issued", id: l.issuedInvoice.id, number: l.issuedInvoice.number }]
            : [],
    ),
  }));

  // Un apunte nuevo solo puede ir a una cuenta viva y de un libro gestionable;
  // las retiradas siguen apareciendo en el filtro de cuenta del listado porque
  // sus apuntes viejos siguen en la tabla.
  const openAccounts = accounts
    .filter((a) => a.isActive && manageableLedgers.includes(a.ledger))
    .map((a) => ({ id: a.id, name: a.name }));
  const categoryOptions = categories
    .filter((c) => c.isActive)
    .map((c) => ({ id: c.id, name: c.name }));
  const seasonOptions = allSeasons.map((s) => ({ id: s.id, name: s.name }));
  const receivedInvoiceOptions = candidateReceivedInvoices.map((i) => ({
    id: i.id,
    ledger: i.ledger,
    number: i.invoiceNumber,
    totalCents: i.totalCents,
    label: i.supplier.name,
  }));
  const issuedInvoiceOptions = candidateIssuedInvoices.map((i) => ({
    id: i.id,
    ledger: i.ledger,
    number: i.number,
    totalCents: i.totalCents,
    label: i.customerName,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("movementsTitle")}
        description={t("movementsSubtitle")}
        actions={
          <>
            <SeasonSelect
              seasons={allSeasons}
              selectedId={season?.id ?? ""}
              extraParams={visible.length > 1 ? { [LEDGER_PARAM]: filter } : undefined}
            />
            {canManage && season && openAccounts.length > 0 ? (
              <>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={
                        visible.length > 1
                          ? `/economia/movimientos/importar?${LEDGER_PARAM}=${navLedger}`
                          : "/economia/movimientos/importar"
                      }
                    />
                  }
                >
                  <UploadIcon data-icon="inline-start" />
                  {t("importAction")}
                </Button>
                <MovementDialog
                  mode="create"
                  accounts={openAccounts}
                  seasons={seasonOptions}
                  categories={categoryOptions}
                  seasonId={season.id}
                />
              </>
            ) : null}
          </>
        }
      />
      <EconomiaSectionNav
        current="movimientos"
        ledger={navLedger}
        visible={visible}
        ledgerFilterSlot={
          <EconomiaLedgerFilter href="/economia/movimientos" filter={filter} visible={visible} />
        }
      />

      {accounts.length === 0 ? (
        <SectionPlaceholder
          icon={LandmarkIcon}
          title={t("noAccountsTitle")}
          description={t("noAccountsDescription")}
        />
      ) : rows.length === 0 ? (
        <SectionPlaceholder
          icon={ArrowLeftRightIcon}
          title={t("noMovementsTitle")}
          description={t("noMovementsDescription")}
        />
      ) : (
        <MovementsBrowser
          movements={rows}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, ledger: a.ledger }))}
          seasons={seasonOptions}
          categories={categoryOptions}
          seasonId={season!.id}
          locale={locale}
          filter={filter}
          manageableLedgers={manageableLedgers}
          receivedInvoices={receivedInvoiceOptions}
          issuedInvoices={issuedInvoiceOptions}
          linkReceivedInvoiceAction={linkMovementToInvoice}
          linkIssuedInvoiceAction={linkMovementToIssuedInvoice}
        />
      )}
    </div>
  );
}
