import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { financialAccounts } from "@/db/schema";
import { ImportMovementsForm } from "@/components/economia/import-movements-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth";
import { ECONOMIA_VIEW_PERMISSIONS, LEDGER_PARAM, canManageLedger, resolveLedger, visibleLedgers } from "@/lib/economia";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaImportarMovimientos") };
}

export default async function ImportarMovimientosPage({
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

  const query = await searchParams;
  const visible = visibleLedgers(user);
  const ledger = resolveLedger(query[LEDGER_PARAM], visible)!;
  // Solo quien puede escribir en el libro llega aquí; el enlace ya se oculta
  // en el listado para quien solo tiene el permiso de lectura.
  if (!canManageLedger(user, ledger)) notFound();

  const accounts = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.ledger, ledger),
    columns: { id: true, name: true, isActive: true },
    orderBy: [asc(financialAccounts.name)],
  });
  const openAccounts = accounts
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, name: a.name }));
  if (openAccounts.length === 0) notFound();

  const backHref =
    visible.length > 1
      ? `/economia/movimientos?${LEDGER_PARAM}=${ledger}`
      : "/economia/movimientos";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        size="compact"
        back={{ href: backHref, label: t("backToMovements") }}
        title={t("importTitle")}
        description={t("importSubtitle")}
      />

      <Card>
        <CardContent>
          <ImportMovementsForm accounts={openAccounts} />
        </CardContent>
      </Card>
    </div>
  );
}
