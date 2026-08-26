"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updateUser } from "@/app/[locale]/(app)/administracion/usuarios/actions";
import type { RoleOption } from "@/components/administracion/role-dialog";
import {
  UserPersonCombobox,
  type PersonOption,
} from "@/components/administracion/user-person-combobox";
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  roleId: string | null;
  roleLabels: string[];
  roleIsSystem: boolean;
  personId: string | null;
  personName: string | null;
  status: "pending" | "active" | "disabled";
  /** Invitado y todavía sin entrar por primera vez. */
  pendingInvitation: boolean;
  lastSignInAt: string | null;
};

/**
 * Edición de una cuenta: nombre, rol y persona vinculada.
 *
 * El correo no se toca desde aquí: cambiarlo abre el flujo de confirmación de
 * Supabase, que es cosa del propio usuario desde sus ajustes.
 *
 * Sin `DialogTrigger`: lo abre el menú de la fila, poniendo el mismo valor en
 * `?dialogo=`.
 */
export function UserDialog({
  user,
  roles,
  personOptions,
  isSelf,
}: {
  user: AdminUserRow;
  roles: RoleOption[];
  personOptions: PersonOption[];
  isSelf: boolean;
}) {
  const t = useTranslations("Administracion");
  const [open, setOpen] = useDialogParam(`usuario:${user.id}`);
  const [state, action] = useActionState(updateUser, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editUserTitle")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={user.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`user-name-${user.id}`}>
                {t("fullNameLabel")}
              </FieldLabel>
              <Input
                id={`user-name-${user.id}`}
                name="fullName"
                defaultValue={user.fullName ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`user-role-${user.id}`}>
                {t("roleLabel")}
              </FieldLabel>
              <Select
                name="roleId"
                defaultValue={user.roleId ?? ""}
                disabled={isSelf}
              >
                <SelectTrigger id={`user-role-${user.id}`} className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      roles.find((r) => r.id === value)?.name ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf ? (
                <FieldDescription>{t("cannotChangeOwnRoleHint")}</FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel>{t("personLabel")}</FieldLabel>
              <UserPersonCombobox
                personOptions={personOptions}
                defaultPersonId={user.personId}
              />
              <FieldDescription>{t("personHint")}</FieldDescription>
            </Field>
          </FieldGroup>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("save")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
