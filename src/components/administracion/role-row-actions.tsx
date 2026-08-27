"use client";

import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { DeleteRoleDialog } from "@/components/administracion/delete-role-dialog";
import { RoleDialog, type RoleOption } from "@/components/administracion/role-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDialogParam } from "@/hooks/use-dialog-param";

/**
 * Menú de acciones de una fila de rol.
 *
 * Mismo montaje que `user-row-actions`: el menú y los diálogos son hermanos, no
 * están anidados. El ítem llama a `setOpen(true)` de un `useDialogParam` con la
 * misma clave que usa el diálogo, y como ambos leen el mismo `?dialogo=` quedan
 * sincronizados sin estado compartido.
 */
export function RoleRowActions({
  role,
  roles,
  userCount,
}: {
  role: RoleOption;
  /** Todos los roles: los necesita el diálogo para "copiar permisos de". */
  roles: RoleOption[];
  userCount: number;
}) {
  const t = useTranslations("Administracion");

  const [, openEdit] = useDialogParam(`rol:${role.id}`);
  const [, openDuplicate] = useDialogParam(`rol-duplicar:${role.id}`);
  const [, openDelete] = useDialogParam(`borrar-rol:${role.id}`);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontalIcon />
          <span className="sr-only">
            {t("roleRowActionsSr", { name: role.name })}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => openEdit(true)}>
            <PencilIcon />
            {t("editRoleAction")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDuplicate(true)}>
            <CopyIcon />
            {t("duplicateRole")}
          </DropdownMenuItem>
          {role.isSystem ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => openDelete(true)}
              >
                <Trash2Icon />
                {t("deleteRoleAction")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RoleDialog mode="edit" roles={roles} role={role} />
      <RoleDialog mode="create" roles={roles} copyFrom={role} />
      {role.isSystem ? null : (
        <DeleteRoleDialog
          role={role}
          userCount={userCount}
          otherRoles={roles.filter((other) => other.id !== role.id)}
        />
      )}
    </>
  );
}
