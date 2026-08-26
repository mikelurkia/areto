import { ShieldCheckIcon } from "lucide-react";
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
import { DeleteRoleDialog } from "@/components/administracion/delete-role-dialog";
import { RoleDialog, type RoleOption } from "@/components/administracion/role-dialog";
import {
  RolesPermissionMatrix,
  type MatrixRole,
} from "@/components/administracion/roles-permission-matrix";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("rolesSubtitle")}</p>
        </div>
        <RoleDialog mode="create" roles={options} />
      </div>

      <AdminSectionNav current="roles" canManageRoles />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colRole")}</TableHead>
            <TableHead>{t("colDescription")}</TableHead>
            <TableHead className="text-right">{t("colUsers")}</TableHead>
            <TableHead className="text-right">{t("colPermissions")}</TableHead>
            <TableHead className="w-32 text-right">{t("colActions")}</TableHead>
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
                  <div className="flex items-center justify-end gap-1">
                    <RoleDialog mode="edit" roles={options} role={option} />
                    <RoleDialog mode="create" roles={options} copyFrom={option} />
                    {role.isSystem ? null : (
                      <DeleteRoleDialog
                        role={option}
                        userCount={role.userAssignments.length}
                        otherRoles={options.filter((o) => o.id !== role.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/*
        Matriz editable: permisos en filas, roles en columnas. Sustituye a la
        ficha por rol y al resumen de solo lectura que había aquí — eran la
        misma información contada dos veces, y comparar dos roles obligaba a ir
        y volver.
      */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" />
          <h2 className="text-lg font-medium">{t("matrixTitle")}</h2>
        </div>
        <RolesPermissionMatrix roles={matrixRoles} granted={granted} canEdit />
      </section>
    </div>
  );
}
