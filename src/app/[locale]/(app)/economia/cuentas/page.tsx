import { LandmarkIcon, TagsIcon } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { economicCategories, financialAccounts } from "@/db/schema";
import { AccountDialog, DeleteAccountDialog } from "@/components/economia/account-dialog";
import { CategoryDialog } from "@/components/economia/category-dialog";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { EmptyValue } from "@/components/empty-value";
import { MaskedIbanText } from "@/components/masked-iban";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import {
  ECONOMIA_VIEW_PERMISSIONS,
  LEDGER_PARAM,
  LEDGERS,
  canManageLedger,
  resolveLedger,
  visibleLedgers,
} from "@/lib/economia";
import { formatCents } from "@/lib/money";

/** `date` de Postgres llega como "YYYY-MM-DD"; se pinta en el idioma de la petición. */
function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("economiaCuentas") };
}

export default async function CuentasPage({
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
  const manageableLedgers = LEDGERS.filter((value) => canManageLedger(user, value));
  // Escribir se comprueba contra el libro de la fila, no contra un permiso
  // global: aquí todas las cuentas son las del libro activo.
  const canManage = canManageLedger(user, ledger);

  const [accounts, categories] = await Promise.all([
    db.query.financialAccounts.findMany({
      where: eq(financialAccounts.ledger, ledger),
      orderBy: [asc(financialAccounts.name)],
    }),
    db.query.economicCategories.findMany({
      orderBy: [
        asc(economicCategories.kind),
        asc(economicCategories.sortOrder),
        asc(economicCategories.name),
      ],
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("accountsTitle")} description={t("accountsSubtitle")} />
      <EconomiaSectionNav current="cuentas" ledger={ledger} visible={visible} />

      <div className="flex flex-col gap-4">
        <SectionHeading
          title={t("accountsHeading")}
          actions={
            canManage ? (
              <AccountDialog
                mode="create"
                ledger={ledger}
                manageableLedgers={manageableLedgers}
              />
            ) : null
          }
        />
        {accounts.length === 0 ? (
          <SectionPlaceholder
            icon={LandmarkIcon}
            title={t("noAccountsTitle")}
            description={t("noAccountsDescription")}
          />
        ) : (
          <Card size="sm">
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("accountNameLabel")}</TableHead>
                    <TableHead priority="secondary">{t("accountKindLabel")}</TableHead>
                    <TableHead priority="secondary">{t("accountIbanLabel")}</TableHead>
                    <TableHead>{t("openingBalanceLabel")}</TableHead>
                    <TableHead priority="secondary">{t("openingBalanceOnLabel")}</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {account.name}
                          {account.isActive ? null : (
                            <StatusBadge tone="neutral" label={t("inactiveBadge")} />
                          )}
                        </span>
                      </TableCell>
                      <TableCell priority="secondary">
                        {t(`accountKind_${account.kind}`)}
                      </TableCell>
                      <TableCell priority="secondary">
                        {account.iban ? <MaskedIbanText value={account.iban} /> : <EmptyValue />}
                      </TableCell>
                      <TableCell>{formatCents(account.openingBalanceCents, locale)}</TableCell>
                      <TableCell priority="secondary">
                        {account.openingBalanceOn ? (
                          formatDate(account.openingBalanceOn, locale)
                        ) : (
                          <EmptyValue />
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <span className="flex justify-end gap-1">
                            <AccountDialog
                              mode="edit"
                              account={account}
                              ledger={ledger}
                              manageableLedgers={manageableLedgers}
                            />
                            <DeleteAccountDialog id={account.id} name={account.name} />
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading
          title={t("categoriesHeading")}
          description={t("categoriesHint")}
          actions={
            manageableLedgers.length > 0 ? <CategoryDialog mode="create" /> : null
          }
        />
        {categories.length === 0 ? (
          <SectionPlaceholder
            icon={TagsIcon}
            title={t("noCategoriesTitle")}
            description={t("noCategoriesDescription")}
          />
        ) : (
          <Card size="sm">
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("categoryNameLabel")}</TableHead>
                    <TableHead>{t("categoryKindLabel")}</TableHead>
                    <TableHead priority="secondary">{t("sortOrderLabel")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {category.name}
                          {category.isActive ? null : (
                            <StatusBadge tone="neutral" label={t("inactiveBadge")} />
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{t(`categoryKind_${category.kind}`)}</TableCell>
                      <TableCell priority="secondary">{category.sortOrder}</TableCell>
                      <TableCell>
                        {manageableLedgers.length > 0 ? (
                          <span className="flex justify-end">
                            <CategoryDialog mode="edit" category={category} />
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
