import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { hasPermission, requirePermission } from "@/lib/auth";
import { AdminSectionNav } from "@/components/administracion/admin-section-nav";
import { AuditLogBrowser, type AuditLogRow } from "@/components/administracion/audit-log-browser";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("auditoria") };
}

/** Últimas filas que se traen del servidor: el listado filtra y pagina en
 * cliente, mismo patrón que el resto de "browser" de la aplicación. */
const MAX_ROWS = 500;

export default async function AuditoriaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const current = await requirePermission("administracion.audit.view");
  const t = await getTranslations("Administracion");

  const entries = await db.query.auditLog.findMany({
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit: MAX_ROWS,
    with: {
      actor: { columns: { email: true, fullName: true } },
    },
  });

  const rows: AuditLogRow[] = entries.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    action: e.action,
    entityType: e.entityType as AuditLogRow["entityType"],
    entityId: e.entityId,
    actorEmail: e.actor?.email ?? null,
    actorName: e.actor?.fullName ?? null,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={t("title")} description={t("auditSubtitle")} />

      <AdminSectionNav
        current="auditoria"
        canManageRoles={hasPermission(current, "roles.manage")}
        canViewAudit
      />

      <AuditLogBrowser rows={rows} />
    </div>
  );
}
