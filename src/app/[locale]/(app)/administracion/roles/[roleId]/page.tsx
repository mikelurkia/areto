import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { roles } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { isPermission, isSystemRoleKey, type Permission } from "@/lib/permissions";
import { RolePermissionsForm } from "@/components/administracion/role-permissions-form";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("roles") };
}

export default async function RolePermissionsPage({
  params,
}: {
  params: Promise<{ locale: string; roleId: string }>;
}) {
  const { locale, roleId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("roles.manage");
  const t = await getTranslations("Administracion");

  const role = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    with: {
      permissions: { columns: { permission: true } },
      // Cuenta por la puente: `users.role_id` ya solo existe para las RLS
      // viejas de Storage y no refleja los roles secundarios.
      userAssignments: { columns: { userId: true } },
    },
  });

  if (!role) notFound();

  const name = isSystemRoleKey(role.key)
    ? t(`roles.${role.key}` as "roles.admin")
    : role.name;

  // Se descarta lo que ya no esté en el catálogo del código: una asignación
  // huérfana no debe aparecer marcada en la matriz.
  const granted: Permission[] = role.permissions
    .map((p) => p.permission)
    .filter((p): p is Permission => isPermission(p));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <BackLink href="/administracion/roles" label={t("backToRoles")} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            {role.isSystem ? (
              <Badge variant="outline">{t("systemBadge")}</Badge>
            ) : null}
            {role.isDefault ? (
              <Badge variant="secondary">{t("defaultBadge")}</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            {role.description ?? t("permissionsSubtitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("roleUserCount", { count: role.userAssignments.length })}
          </p>
        </div>
      </div>

      <RolePermissionsForm
        roleId={role.id}
        roleKey={role.key}
        granted={granted}
        canEdit
      />
    </div>
  );
}
