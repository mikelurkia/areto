import { TruckIcon } from "lucide-react";
import { asc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { economicCategories, suppliers } from "@/db/schema";
import { EconomiaSectionNav } from "@/components/economia/economia-section-nav";
import { DeleteSupplierDialog, SupplierDialog } from "@/components/economia/supplier-dialog";
import { EmptyValue } from "@/components/empty-value";
import { MaskedIbanText } from "@/components/masked-iban";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
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
  canManageSuppliers,
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
  return { title: t("economiaProveedores") };
}

export default async function ProveedoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ libro?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission(ECONOMIA_VIEW_PERMISSIONS);
  const t = await getTranslations("Economia");

  const visible = visibleLedgers(user);
  const ledger = resolveLedger((await searchParams)[LEDGER_PARAM], visible)!;
  const canManage = canManageSuppliers(user);

  const [supplierRows, categories] = await Promise.all([
    db.query.suppliers.findMany({ orderBy: [asc(suppliers.name)] }),
    db.query.economicCategories.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(economicCategories.sortOrder), asc(economicCategories.name)],
    }),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("suppliersTitle")}
        description={t("suppliersSubtitle")}
        actions={canManage ? <SupplierDialog mode="create" categories={categories} /> : null}
      />
      <EconomiaSectionNav current="proveedores" ledger={ledger} visible={visible} />

      {supplierRows.length === 0 ? (
        <SectionPlaceholder
          icon={TruckIcon}
          title={t("noSuppliersTitle")}
          description={t("noSuppliersDescription")}
        />
      ) : (
        <Card size="sm">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("supplierNameLabel")}</TableHead>
                  <TableHead priority="secondary">{t("supplierTaxIdLabel")}</TableHead>
                  <TableHead priority="tertiary">{t("accountIbanLabel")}</TableHead>
                  <TableHead priority="secondary">{t("supplierDefaultCategoryLabel")}</TableHead>
                  <TableHead priority="tertiary">{t("supplierContactNameLabel")}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierRows.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell priority="secondary">
                      {supplier.taxId ?? <EmptyValue />}
                    </TableCell>
                    <TableCell priority="tertiary">
                      {supplier.iban ? <MaskedIbanText value={supplier.iban} /> : <EmptyValue />}
                    </TableCell>
                    <TableCell priority="secondary">
                      {supplier.defaultCategoryId
                        ? (categoryName.get(supplier.defaultCategoryId) ?? <EmptyValue />)
                        : <EmptyValue />}
                    </TableCell>
                    <TableCell priority="tertiary">
                      {supplier.contactName ?? <EmptyValue />}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <span className="flex justify-end gap-1">
                          <SupplierDialog mode="edit" supplier={supplier} categories={categories} />
                          <DeleteSupplierDialog id={supplier.id} name={supplier.name} />
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
  );
}
