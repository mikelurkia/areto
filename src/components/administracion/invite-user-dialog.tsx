"use client";

import { useActionState, useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { inviteUser } from "@/app/[locale]/(app)/administracion/usuarios/actions";
import { RoleMultiCombobox } from "@/components/administracion/role-multi-combobox";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";

/** Alta de un usuario: se le manda un correo con un enlace para entrar. */
export function InviteUserDialog({
  roles,
  defaultRoleId,
  personOptions,
  available,
}: {
  roles: RoleOption[];
  defaultRoleId: string | null;
  personOptions: PersonOption[];
  /** Falso si no hay clave de servicio: sin ella no se pueden enviar correos. */
  available: boolean;
}) {
  const t = useTranslations("Administracion");
  const [open, setOpen] = useDialogParam("usuario-nuevo");
  const [state, action] = useActionState(inviteUser, {});
  const [email, setEmail] = useState("");
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={!available} />}>
        <UserPlusIcon data-icon="inline-start" />
        {t("inviteUser")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-email">{t("emailLabel")}</FieldLabel>
              <Input
                id="invite-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-name">{t("fullNameLabel")}</FieldLabel>
              <Input id="invite-name" name="fullName" />
            </Field>
            <Field>
              <FieldLabel>{t("rolesLabel")}</FieldLabel>
              <FieldDescription>{t("rolesHint")}</FieldDescription>
              <RoleMultiCombobox
                // Igual que en el diálogo de edición: si cambia cuál es el rol
                // por defecto, la preselección vuelve a sembrarse.
                key={defaultRoleId ?? ""}
                roles={roles}
                selected={defaultRoleId ? [defaultRoleId] : []}
              />
            </Field>
            <Field>
              <FieldLabel>{t("personLabel")}</FieldLabel>
              <UserPersonCombobox
                personOptions={personOptions}
                defaultPersonId={null}
                emailHint={email}
              />
              <FieldDescription>{t("personHint")}</FieldDescription>
            </Field>
          </FieldGroup>
          <FieldDescription>{t("emailRateLimitHint")}</FieldDescription>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("inviteSubmit")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
