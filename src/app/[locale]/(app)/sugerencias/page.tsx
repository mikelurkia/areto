import { desc, eq } from "drizzle-orm";
import { LightbulbIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { featureRequests, users } from "@/db/schema";
import { hasPermission, requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format-date";
import { STATUS_TONE } from "@/lib/feature-request-status";
import { FeatureRequestForm } from "@/components/sugerencias/feature-request-form";
import { FeatureRequestStatusSelect } from "@/components/sugerencias/feature-request-status-select";
import { PageHeader } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("sugerencias") };
}

export default async function SugerenciasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("sugerencias.view");
  const t = await getTranslations("Sugerencias");
  const canManage = hasPermission(user, "sugerencias.manage");

  const rows = await db
    .select({
      id: featureRequests.id,
      title: featureRequests.title,
      description: featureRequests.description,
      status: featureRequests.status,
      createdAt: featureRequests.createdAt,
      requestedByName: users.fullName,
      requestedByEmail: users.email,
    })
    .from(featureRequests)
    .innerJoin(users, eq(featureRequests.requestedByUserId, users.id))
    .where(canManage ? undefined : eq(featureRequests.requestedByUserId, user.id))
    .orderBy(desc(featureRequests.createdAt));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card size="sm" className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureRequestForm />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <SectionPlaceholder
          icon={LightbulbIcon}
          title={t("emptyTitle")}
          description={canManage ? t("emptyDescriptionAll") : t("emptyDescriptionOwn")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTitle")}</TableHead>
              {canManage ? <TableHead priority="secondary">{t("colRequestedBy")}</TableHead> : null}
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead priority="secondary">{t("colCreatedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.title}</TableCell>
                {canManage ? (
                  <TableCell priority="secondary">
                    {row.requestedByName ?? row.requestedByEmail}
                  </TableCell>
                ) : null}
                <TableCell>
                  {canManage ? (
                    <FeatureRequestStatusSelect id={row.id} title={row.title} status={row.status} />
                  ) : (
                    <StatusBadge tone={STATUS_TONE[row.status]} label={t(`status.${row.status}`)} />
                  )}
                </TableCell>
                <TableCell priority="secondary" nowrap>
                  {formatDateTime(row.createdAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
