import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import {
  isPermission,
  isSystemRoleKey,
  PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import { AdminSectionNav } from "@/components/administracion/admin-section-nav";
import { RoleDialog, type RoleOption } from "@/components/administracion/role-dialog";
import { RoleRowActions } from "@/components/administracion/role-row-actions";
import {
  RolesPermissionMatrix,
  type MatrixRole,
} from "@/components/administracion/roles-permission-matrix";
import { RolesTabs } from "@/components/administracion/roles-tabs";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
  return { title: t("roles") };
}

export default async function RolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("roles.manage");
  const t = await getTranslations("Administracion");

  const allRoles = await db.query.roles.findMany({
    with: {
      permissions: { columns: { permission: true } },
      // Cuenta por la puente: `users.role_id` ya solo existe para las RLS
      // viejas de Storage y no refleja los roles secundarios.
      userAssignments: { columns: { userId: true } },
    },
    orderBy: (r, { asc }) => [asc(r.sortOrder), asc(r.name)],
  });

  // Los roles de fábrica se muestran con su etiqueta traducida; los que crea el
  // club, con el nombre que le hayan puesto (son datos suyos, no de la app).
  const label = (role: { key: string; name: string }) =>
    isSystemRoleKey(role.key) ? t(`roles.${role.key}` as "roles.admin") : role.name;

  const matrixRoles: MatrixRole[] = allRoles.map((r) => ({
    id: r.id,
    key: r.key,
    label: label(r),
    description: r.description,
    isSystem: r.isSystem,
    isDefault: r.isDefault,
    userCount: r.userAssignments.length,
  }));

  // Ya filtrados contra el catálogo del código: lo que no esté en él no
  // concede nada y tampoco tiene por qué llegar al cliente.
  const granted: Record<string, Permission[]> = Object.fromEntries(
    allRoles.map((r) => [
      r.id,
      r.permissions.map((p) => p.permission).filter(isPermission),
    ]),
  );

  const options: RoleOption[] = allRoles.map((r) => ({
    id: r.id,
    key: r.key,
    name: label(r),
    description: r.description,
    isSystem: r.isSystem,
    isDefault: r.isDefault,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("rolesSubtitle")}
        actions={<RoleDialog mode="create" roles={options} />}
      />

      <AdminSectionNav current="roles" canManageRoles />

      {/*
        Dos pestañas y no dos secciones apiladas: la tabla y la matriz son dos
        maneras de mirar lo mismo y juntas saturaban la pantalla. La pestaña
        viaja en `?vista=`, así que recargar o compartir el enlace la mantiene.

        La matriz —permisos en filas, roles en columnas— ya sustituyó en su día
        a la ficha por rol y al resumen de solo lectura: eran la misma
        información contada dos veces, y comparar dos roles obligaba a ir y
        volver.
      */}
      <RolesTabs
        roles={
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colRole")}</TableHead>
                <TableHead>{t("colDescription")}</TableHead>
                <TableHead className="text-right">{t("colUsers")}</TableHead>
                <TableHead className="text-right">{t("colPermissions")}</TableHead>
                <TableHead className="w-12 text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRoles.map((role) => {
                const option = options.find((o) => o.id === role.id)!;
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{option.name}</span>
                        {role.isSystem ? (
                          <Badge variant="outline">{t("systemBadge")}</Badge>
                        ) : null}
                        {role.isDefault ? (
                          <Badge variant="secondary">{t("defaultBadge")}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {role.userAssignments.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {t("permissionCount", {
                        count: role.permissions.length,
                        total: PERMISSIONS.length,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <RoleRowActions
                          role={option}
                          roles={options}
                          userCount={role.userAssignments.length}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        }
        permisos={
          <RolesPermissionMatrix roles={matrixRoles} granted={granted} canEdit />
        }
      />
    </div>
  );
}
