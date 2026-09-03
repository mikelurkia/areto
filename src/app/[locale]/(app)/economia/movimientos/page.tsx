import { ArrowLeftRightIcon, LandmarkIcon } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { accountMovements, economicCategories, financialAccounts, seasons } from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { MovementDialog } from "@/components/economia/movement-dialog";
import { MovementsBrowser } from "@/components/economia/movements-browser";
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

  const ledger = resolveLedger(query[LEDGER_PARAM], visible)!;
  const canManage = canManageLedger(user, ledger);
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
          eq(accountMovements.ledger, ledger),
          eq(accountMovements.seasonId, season.id),
        ),
        orderBy: [desc(accountMovements.bookedOn), desc(accountMovements.createdAt)],
        with: {
          account: { columns: { name: true } },
          category: { columns: { name: true } },
        },
      })
    : [];

  const accounts = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.ledger, ledger),
    columns: { id: true, name: true, isActive: true },
    orderBy: [asc(financialAccounts.name)],
  });

  const rows = movements.map((m) => ({
    id: m.id,
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
  }));

  // Un apunte nuevo solo puede ir a una cuenta viva; las retiradas siguen
  // apareciendo en el filtro porque sus apuntes viejos siguen en el listado.
  const openAccounts = accounts
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, name: a.name }));
  const categoryOptions = categories
    .filter((c) => c.isActive)
    .map((c) => ({ id: c.id, name: c.name }));
  const seasonOptions = allSeasons.map((s) => ({ id: s.id, name: s.name }));

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
              extraParams={visible.length > 1 ? { [LEDGER_PARAM]: ledger } : undefined}
            />
            {canManage && season && openAccounts.length > 0 ? (
              <MovementDialog
                mode="create"
                accounts={openAccounts}
                seasons={seasonOptions}
                categories={categoryOptions}
                seasonId={season.id}
              />
            ) : null}
          </>
        }
      />
      <EconomiaSectionNav current="movimientos" ledger={ledger} visible={visible} />

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
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          seasons={seasonOptions}
          categories={categoryOptions}
          seasonId={season!.id}
          locale={locale}
          canManage={canManage}
        />
      )}
    </div>
  );
}
