import { LandmarkIcon, PiggyBankIcon } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { financialAccounts } from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatTile } from "@/components/stat-tile";
import { requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  resolveLedger,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economia") };
}

export default async function EconomiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);
  const ledger = resolveLedger((await searchParams)[LEDGER_PARAM], visible)!;

  // El filtro por libro va en el `where`, nunca en el render: pedir
  // `?libro=internal` sin el permiso cae en el libro oficial y no trae ni una
  // fila del otro.
  const accounts = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.ledger, ledger),
    orderBy: [asc(financialAccounts.name)],
  });

  const openAccounts = accounts.filter((account) => account.isActive);
  const totalCents = openAccounts.reduce((sum, a) => sum + a.openingBalanceCents, 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EconomiaSectionNav current="resumen" ledger={ledger} visible={visible} />

      {openAccounts.length === 0 ? (
        <SectionPlaceholder
          icon={LandmarkIcon}
          title={t("noAccountsTitle")}
          description={t("noAccountsDescription")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SectionHeading
            title={t("openingBalancesHeading")}
            description={t("openingBalancesHint")}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={t("totalOpeningBalanceLabel")}
              value={formatCents(totalCents, locale)}
              icon={PiggyBankIcon}
            />
            {openAccounts.map((account) => (
              <StatTile
                key={account.id}
                label={account.name}
                value={formatCents(account.openingBalanceCents, locale)}
                hint={t(`accountKind_${account.kind}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
