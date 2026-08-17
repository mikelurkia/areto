"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import {
  login,
  signInWithGoogle,
  signup,
  type AuthState,
} from "@/app/[locale]/(auth)/actions";
import { GoogleIcon } from "@/components/icons/google";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initialState: AuthState = {};

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );
  const [googleState, googleAction] = useActionState(
    signInWithGoogle,
    initialState,
  );
  useActionToast(signupState);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Acceso con Google */}
      <form action={googleAction}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="outline" className="w-full">
          <GoogleIcon data-icon="inline-start" />
          {t("continueWithGoogle")}
        </SubmitButton>
      </form>
      {googleState.error ? (
        <p className="text-sm text-destructive">{googleState.error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t("orWithEmail")}
        </span>
        <Separator className="flex-1" />
      </div>

      <Tabs defaultValue="login">
        <TabsList variant="default" className="w-full">
          <TabsTrigger value="login" className="flex-1">
            {t("loginTab")}
          </TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">
            {t("signupTab")}
          </TabsTrigger>
        </TabsList>

        {/* Iniciar sesión */}
        <TabsContent value="login">
          <form action={loginAction}>
            <input type="hidden" name="next" value={next} />
            <FieldGroup>
              <Field data-invalid={loginState.error ? true : undefined}>
                <FieldLabel htmlFor="login-email">{t("email")}</FieldLabel>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-invalid={loginState.error ? true : undefined}
                />
              </Field>
              <Field data-invalid={loginState.error ? true : undefined}>
                <FieldLabel htmlFor="login-password">
                  {t("password")}
                </FieldLabel>
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
        </TabsContent>

        {/* Registrarse */}
        <TabsContent value="signup">
          <form action={signupAction}>
            <FieldGroup>
              <Field data-invalid={signupState.error ? true : undefined}>
                <FieldLabel htmlFor="signup-email">{t("email")}</FieldLabel>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-invalid={signupState.error ? true : undefined}
                />
              </Field>
              <Field data-invalid={signupState.error ? true : undefined}>
                <FieldLabel htmlFor="signup-password">
                  {t("password")}
                </FieldLabel>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  aria-invalid={signupState.error ? true : undefined}
                />
                <FieldDescription
                  className={signupState.error ? "text-destructive" : undefined}
                >
                  {signupState.error ?? t("minChars")}
                </FieldDescription>
              </Field>
              <SubmitButton className="w-full">
                {signupPending ? t("creatingAccount") : t("createAccount")}
              </SubmitButton>
            </FieldGroup>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
