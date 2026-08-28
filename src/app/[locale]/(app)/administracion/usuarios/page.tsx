import { StatusBadge } from "@/components/status-badge";
import { TriangleAlertIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { Link } from "@/i18n/navigation";
import { hasPermission, requirePermission } from "@/lib/auth";
import { isSystemRoleKey } from "@/lib/permissions";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { listAuthDirectory } from "@/lib/supabase/auth-directory";
import { AdminSectionNav } from "@/components/administracion/admin-section-nav";
import { InviteUserDialog } from "@/components/administracion/invite-user-dialog";
import type { RoleOption } from "@/components/administracion/role-dialog";
import type { AdminUserRow } from "@/components/administracion/user-dialog";
import { UserRowActions } from "@/components/administracion/user-row-actions";
import type { PersonOption } from "@/components/administracion/user-person-combobox";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  return { title: t("usuarios") };
}

/** Activos primero, luego los pendientes de aceptar y por último los desactivados. */
const STATUS_ORDER = { active: 0, pending: 1, disabled: 2 } as const;

export default async function UsuariosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const current = await requirePermission("usuarios.manage");
  const t = await getTranslations("Administracion");

  // Tres lecturas directas de la página: el `Promise.all` es el patrón habitual
  // del repositorio. La llamada a la Admin API va fuera a propósito — es una
  // petición HTTP, no una consulta, y no debe sumar concurrencia al pooler.
  const [userRows, allRoles, allPersons] = await Promise.all([
    db.query.users.findMany({
      with: {
        roleAssignments: { with: { role: true } },
        person: { columns: { id: true, firstName: true, lastName: true } },
      },
      orderBy: (u, { asc }) => [asc(u.email)],
    }),
    db.query.roles.findMany({
      orderBy: (r, { asc }) => [asc(r.sortOrder), asc(r.name)],
    }),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true, email: true },
      orderBy: (p, { asc }) => [asc(p.lastName), asc(p.firstName)],
    }),
  ]);

  const authDirectory = await listAuthDirectory();

  const roleLabel = (role: { key: string; name: string }) =>
    isSystemRoleKey(role.key) ? t(`roles.${role.key}` as "roles.admin") : role.name;

  /** Roles de una cuenta, ordenados como en la tabla de roles. */
  const rolesOf = (u: (typeof userRows)[number]) =>
    u.roleAssignments
      .map((a) => a.role)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const roleOptions: RoleOption[] = allRoles.map((r) => ({
    id: r.id,
    key: r.key,
    name: roleLabel(r),
    description: r.description,
    isSystem: r.isSystem,
    isDefault: r.isDefault,
  }));

  // Qué persona está ocupada por qué cuenta, para que el selector lo enseñe.
  const personOwner = new Map(
    userRows.filter((u) => u.personId).map((u) => [u.personId!, u.email]),
  );

  const personOptions: PersonOption[] = allPersons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    linkedToEmail: personOwner.get(p.id) ?? null,
  }));

  const rows: AdminUserRow[] = userRows
    .map((u) => {
      const auth = authDirectory.get(u.id);
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        roleIds: rolesOf(u).map((r) => r.id),
        roleLabels: rolesOf(u).map(roleLabel),
        personId: u.personId,
        personName: u.person
          ? `${u.person.firstName} ${u.person.lastName}`.trim()
          : null,
        status: u.status,
        // Sin clave de servicio no sabemos si ya entró; en ese caso nos
        // quedamos con lo que dice nuestra tabla y no inventamos un estado.
        pendingInvitation:
          u.invitedAt !== null && auth !== undefined && auth.lastSignInAt === null,
        lastSignInAt: auth?.lastSignInAt ?? null,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.email.localeCompare(b.email),
    );

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const defaultRole = allRoles.find((r) => r.isDefault) ?? allRoles[0];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("usersSubtitle")}
        actions={
          <InviteUserDialog
            roles={roleOptions}
            defaultRoleId={defaultRole?.id ?? null}
            personOptions={personOptions}
            available={isSupabaseAdminConfigured}
          />
        }
      />

      <AdminSectionNav
        current="usuarios"
        canManageRoles={hasPermission(current, "roles.manage")}
      />

      {!isSupabaseAdminConfigured ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription className="text-foreground">
            {t("adminApiNotConfiguredHint")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colUser")}</TableHead>
            <TableHead priority="secondary">{t("colRole")}</TableHead>
            <TableHead priority="tertiary">{t("colPerson")}</TableHead>
            <TableHead priority="secondary">{t("colStatus")}</TableHead>
            <TableHead priority="tertiary">{t("colLastSignIn")}</TableHead>
            <TableHead className="w-12 text-right">{t("colActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      {row.email.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid">
                    <span className="font-medium">{row.fullName ?? row.email}</span>
                    {row.fullName ? (
                      <span className="text-xs text-muted-foreground">
                        {row.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell priority="secondary">
                {row.roleLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {row.roleLabels.map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t("noRole")}</span>
                )}
              </TableCell>
              <TableCell priority="tertiary">
                {row.personId && row.personName ? (
                  <Link
                    href={`/personas/${row.personId}`}
                    className="hover:underline"
                  >
                    {row.personName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell priority="secondary">
                {row.status === "disabled" ? (
                  <StatusBadge tone="danger" label={t("statusDisabled")} />
                ) : row.pendingInvitation || row.status === "pending" ? (
                  <StatusBadge tone="neutral" label={t("statusPending")} />
                ) : (
                  <StatusBadge tone="positive" label={t("statusActive")} />
                )}
              </TableCell>
              <TableCell priority="tertiary" nowrap className="text-muted-foreground">
                {row.lastSignInAt
                  ? dateFmt.format(new Date(row.lastSignInAt))
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <UserRowActions
                  user={row}
                  roles={roleOptions}
                  personOptions={personOptions}
                  isSelf={row.id === current.id}
                  adminApiAvailable={isSupabaseAdminConfigured}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
