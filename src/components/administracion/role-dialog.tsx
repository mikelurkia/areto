"use client";

import { useActionState } from "react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { createRole, updateRole } from "@/app/[locale]/(app)/administracion/roles/actions";
import { FormError } from "@/components/form-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

export type RoleOption = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
};

type RoleDialogProps =
  | { mode: "create"; roles: RoleOption[]; copyFrom?: RoleOption }
  | { mode: "edit"; roles: RoleOption[]; role: RoleOption };

/**
 * Crear, duplicar y renombrar un rol.
 *
 * "Duplicar" no es una acción aparte: es este mismo diálogo en modo creación
 * con el rol de origen ya elegido en "copiar permisos de".
 */
export function RoleDialog(props: RoleDialogProps) {
  const t = useTranslations("Administracion");

  const dialogKey =
    props.mode === "create"
      ? props.copyFrom
        ? `rol-duplicar:${props.copyFrom.id}`
        : "rol-nuevo"
      : `rol:${props.role.id}`;

  const [open, setOpen] = useDialogParam(dialogKey);
  const [state, action] = useActionState(
    props.mode === "create" ? createRole : updateRole,
    {},
  );
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  const initial =
    props.mode === "edit"
      ? props.role
      : props.copyFrom
        ? { ...props.copyFrom, name: t("roleCopyName", { name: props.copyFrom.name }) }
        : null;

  // Los roles de fábrica se muestran con su etiqueta traducida, así que
  // renombrarlos dejaría el nombre a medias entre idiomas.
  const nameLocked = props.mode === "edit" && props.role.isSystem;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        Solo el botón de la cabecera lleva disparador propio. Editar y duplicar
        se abren desde el menú de acciones de la fila (`role-row-actions`), que
        comparte con este diálogo la clave de `useDialogParam`.
      */}
      {props.mode === "create" && !props.copyFrom ? (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          {t("createRole")}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? t("createRoleTitle") : t("editRoleTitle")}
          </DialogTitle>
          <DialogDescription>{t("roleDialogDescription")}</DialogDescription>
        </DialogHeader>
        {/*
          Los campos son no controlados y sus valores de partida salen de
          `initial`, que cambia cuando la página se revalida —el diálogo sigue
          montado entre medias—. Sin esta `key` React se queda con el valor de
          la primera vez y Base UI avisa de que se está cambiando el estado
          inicial de una casilla no controlada. Mismo recurso que en
          `registration-availability-form.tsx`.
        */}
        <form
          key={`${initial?.name ?? ""}|${initial?.description ?? ""}|${initial?.isDefault ?? false}`}
          action={action}
          className="flex flex-col gap-4"
        >
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.role.id} />
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`role-name-${dialogKey}`}>
                {t("roleNameLabel")}
              </FieldLabel>
              <Input
                id={`role-name-${dialogKey}`}
                name="name"
                defaultValue={initial?.name ?? ""}
                placeholder={t("roleNamePlaceholder")}
                readOnly={nameLocked}
                required={!nameLocked}
                maxLength={60}
              />
              {nameLocked ? (
                <FieldDescription>{t("systemRoleNameLocked")}</FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`role-description-${dialogKey}`}>
                {t("roleDescriptionLabel")}
              </FieldLabel>
              <Textarea
                id={`role-description-${dialogKey}`}
                name="description"
                rows={2}
                defaultValue={initial?.description ?? ""}
                placeholder={t("roleDescriptionPlaceholder")}
              />
            </Field>
            {props.mode === "create" ? (
              <Field>
                <FieldLabel htmlFor={`role-copy-${dialogKey}`}>
                  {t("copyFromLabel")}
                </FieldLabel>
                <Select
                  name="copyFromRoleId"
                  defaultValue={props.copyFrom?.id ?? "none"}
                >
                  <SelectTrigger id={`role-copy-${dialogKey}`} className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "none"
                          ? t("copyFromNone")
                          : (props.roles.find((r) => r.id === value)?.name ?? "")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("copyFromNone")}</SelectItem>
                    {props.roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{t("copyFromHint")}</FieldDescription>
              </Field>
            ) : null}
            <Field orientation="horizontal">
              <Checkbox
                id={`role-default-${dialogKey}`}
                name="makeDefault"
                defaultChecked={initial?.isDefault ?? false}
              />
              <div>
                <FieldLabel
                  htmlFor={`role-default-${dialogKey}`}
                  className="font-normal"
                >
                  {t("makeDefaultLabel")}
                </FieldLabel>
                <FieldDescription>{t("makeDefaultHint")}</FieldDescription>
              </div>
            </Field>
          </FieldGroup>
          <FormError message={state.error} />
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
