"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { deleteRole } from "@/app/[locale]/(app)/administracion/roles/actions";
import type { RoleOption } from "@/components/administracion/role-dialog";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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

/**
 * Borrado de un rol.
 *
 * Si tiene usuarios asignados no se bloquea a secas: se pide a dónde pasan.
 * La clave foránea es `restrict`, así que sin esto el borrado fallaría con un
 * error de base de datos y el club se quedaría sin saber qué hacer.
 */
export function DeleteRoleDialog({
  role,
  userCount,
  otherRoles,
}: {
  role: RoleOption;
  userCount: number;
  otherRoles: RoleOption[];
}) {
  const t = useTranslations("Administracion");
  const [open, setOpen] = useDialogParam(`borrar-rol:${role.id}`);
  const [state, action] = useActionState(deleteRole, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="text-destructive" />
        }
      >
        <Trash2Icon />
        <span className="sr-only">{t("deleteRoleSr", { name: role.name })}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteRoleTitle", { name: role.name })}</DialogTitle>
          <DialogDescription>
            {userCount > 0
              ? t("deleteRoleWithUsers", { count: userCount })
              : t("deleteRoleDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={role.id} />
          {userCount > 0 ? (
            <Field>
              <FieldLabel htmlFor={`reassign-${role.id}`}>
                {t("reassignRoleLabel")}
              </FieldLabel>
              <Select name="reassignRoleId" defaultValue={otherRoles[0]?.id ?? ""}>
                <SelectTrigger id={`reassign-${role.id}`} className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      otherRoles.find((r) => r.id === value)?.name ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherRoles.map((other) => (
                    <SelectItem key={other.id} value={other.id}>
                      {other.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("reassignRoleHint")}</FieldDescription>
            </Field>
          ) : null}
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive">{t("deleteRoleButton")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
