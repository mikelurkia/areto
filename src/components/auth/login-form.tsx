"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  login,
  requestPasswordReset,
  type AuthState,
} from "@/app/[locale]/(auth)/actions";
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
import { useActionToast } from "@/hooks/use-action-toast";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";
import { useDialogParam } from "@/hooks/use-dialog-param";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: AuthState = {};

/**
 * Acceso a la aplicación.
 *
 * Ya no hay pestaña de "Registrarse": al club se entra por invitación, desde
 * /administracion/usuarios. Lo que sí hay ahora es "he olvidado mi contraseña",
 * que antes faltaba y dejaba a cualquiera fuera sin remedio.
 */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );

  // `autoFocus` no basta: al llegar por navegación de cliente, el layout-router
  // de Next enfoca el segmento recién montado en un layout effect posterior y
  // se lleva el foco. Un efecto pasivo corre después y lo recupera.
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <div className="flex w-full flex-col gap-4">
      <form action={loginAction}>
        <input type="hidden" name="next" value={next} />
        <FieldGroup>
          <Field data-invalid={loginState.error ? true : undefined}>
            <FieldLabel htmlFor="login-email">{t("email")}</FieldLabel>
            <Input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={loginState.error ? true : undefined}
            />
          </Field>
          <Field data-invalid={loginState.error ? true : undefined}>
            <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={loginState.error ? true : undefined}
            />
            {loginState.error ? (
              <FieldDescription className="text-destructive">
                {loginState.error}
              </FieldDescription>
            ) : null}
          </Field>
          <SubmitButton className="w-full">
            {loginPending ? t("signingIn") : t("signIn")}
          </SubmitButton>
        </FieldGroup>
      </form>

      <ForgotPasswordDialog />

      <p className="text-center text-xs text-muted-foreground">
        {t("inviteOnlyHint")}
      </p>
    </div>
  );
}

function ForgotPasswordDialog() {
  const t = useTranslations("Login");
  const [open, setOpen] = useDialogParam("recuperar-contrasena");
  const [state, action] = useActionState(requestPasswordReset, initialState);
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="link" size="sm" className="self-center" />}
      >
        {t("forgotPassword")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("forgotPasswordTitle")}</DialogTitle>
          <DialogDescription>{t("forgotPasswordDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-email">{t("email")}</FieldLabel>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
          </FieldGroup>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton>{t("sendResetEmail")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
