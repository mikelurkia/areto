"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { logout } from "@/app/[locale]/(auth)/actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Cerrar sesión con recarga completa del navegador, igual que en el pie del
 * sidebar: `logout` solo cierra la sesión y dice a dónde ir. Así no queda en
 * memoria el estado de las pantallas del usuario anterior, que React conserva
 * montadas entre navegaciones.
 */
export function LogoutButton() {
  const t = useTranslations("Sidebar");

  return (
    <form
      action={async () => {
        const { redirectTo } = await logout();
        window.location.href = redirectTo;
      }}
    >
      <SubmitButton variant="outline" className="w-full">
        <LogOutIcon data-icon="inline-start" />
        {t("logout")}
      </SubmitButton>
    </form>
  );
}
