"use client";

import { useActionState } from "react";
import {
  BanIcon,
  CircleCheckIcon,
  KeyRoundIcon,
  MailIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UserCogIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  deleteUser,
  resendInvitation,
  sendPasswordReset,
  toggleUserStatus,
} from "@/app/[locale]/(app)/administracion/usuarios/actions";
import type { RoleOption } from "@/components/administracion/role-dialog";
import type { PersonOption } from "@/components/administracion/user-person-combobox";
import { UserDialog, type AdminUserRow } from "@/components/administracion/user-dialog";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

/**
 * Menú de acciones de una fila de usuario.
 *
 * El menú y los diálogos son hermanos, no están anidados: el ítem del menú
 * llama a `setOpen(true)` de un `useDialogParam` con la misma clave que usa el
 * diálogo, y como los dos leen el mismo `?dialogo=` quedan sincronizados sin
 * estado compartido ni props que atravesar.
 */
export function UserRowActions({
  user,
  roles,
  personOptions,
  isSelf,
  adminApiAvailable,
}: {
  user: AdminUserRow;
  roles: RoleOption[];
  personOptions: PersonOption[];
  isSelf: boolean;
  adminApiAvailable: boolean;
}) {
  const t = useTranslations("Administracion");

  const [, openEdit] = useDialogParam(`usuario:${user.id}`);
  const [, openState] = useDialogParam(`estado-usuario:${user.id}`);
  const [, openDelete] = useDialogParam(`borrar-usuario:${user.id}`);

  const [resendState, resendAction] = useActionState(resendInvitation, {});
  const [resetState, resetAction] = useActionState(sendPasswordReset, {});
  useActionToast(resendState);
  useActionToast(resetState);

  const isActive = user.status === "active";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontalIcon />
          <span className="sr-only">
            {t("rowActionsSr", { email: user.email })}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => openEdit(true)}>
            <UserCogIcon />
            {t("editUser")}
          </DropdownMenuItem>

          {user.pendingInvitation ? (
            <form action={resendAction}>
              <input type="hidden" name="id" value={user.id} />
              <DropdownMenuItem
                nativeButton
                render={<button type="submit" className="w-full" />}
                disabled={!adminApiAvailable}
              >
                <MailIcon />
                {t("resendInvitation")}
              </DropdownMenuItem>
            </form>
          ) : (
            <form action={resetAction}>
              <input type="hidden" name="id" value={user.id} />
              <DropdownMenuItem
                nativeButton
                render={<button type="submit" className="w-full" />}
                disabled={!adminApiAvailable}
              >
                <KeyRoundIcon />
                {t("sendPasswordReset")}
              </DropdownMenuItem>
            </form>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => openState(true)} disabled={isSelf}>
            {isActive ? (
              <>
                <BanIcon />
                {t("deactivate")}
              </>
            ) : (
              <>
                <CircleCheckIcon />
                {t("reactivate")}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => openDelete(true)}
            disabled={isSelf || !adminApiAvailable}
          >
            <Trash2Icon />
            {t("deleteUser")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserDialog
        user={user}
        roles={roles}
        personOptions={personOptions}
        isSelf={isSelf}
      />
      <UserStatusDialog user={user} />
      <DeleteUserDialog user={user} />
    </>
  );
}

/** Confirmación de desactivar o reactivar el acceso. */
function UserStatusDialog({ user }: { user: AdminUserRow }) {
  const t = useTranslations("Administracion");
  const [open, setOpen] = useDialogParam(`estado-usuario:${user.id}`);
  const [state, action] = useActionState(toggleUserStatus, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const activate = user.status !== "active";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activate
              ? t("reactivateTitle", { email: user.email })
              : t("deactivateTitle", { email: user.email })}
          </DialogTitle>
          <DialogDescription>
            {activate ? t("reactivateDescription") : t("deactivateDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="activate" value={String(activate)} />
          {state.error ? (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant={activate ? "default" : "destructive"}>
              {activate ? t("reactivate") : t("deactivate")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Borrado definitivo de la cuenta (perfil + cuenta de Supabase Auth). */
function DeleteUserDialog({ user }: { user: AdminUserRow }) {
  const t = useTranslations("Administracion");
  const [open, setOpen] = useDialogParam(`borrar-usuario:${user.id}`);
  const [state, action] = useActionState(deleteUser, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteUserTitle", { email: user.email })}</DialogTitle>
          <DialogDescription>{t("deleteUserDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="id" value={user.id} />
          {state.error ? (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("deleteUserButton")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
