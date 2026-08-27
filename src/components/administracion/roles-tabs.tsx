"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

/** Primera vista = la de por defecto, la que no deja parámetro en la URL. */
const VIEWS = ["roles", "permisos"] as const;

/**
 * Reparte la pantalla de roles en dos pestañas.
 *
 * El contenido lo sigue renderizando el servidor y llega por props: aquí solo
 * se decide cuál se ve. Se usa el estilo de píldora (`variant="default"`) y no
 * el subrayado, porque justo encima está `AdminSectionNav` —Usuarios/Roles—,
 * que ya son pestañas subrayadas: dos filas idénticas se leerían como el mismo
 * nivel de navegación.
 */
export function RolesTabs({
  roles,
  permisos,
}: {
  roles: React.ReactNode;
  permisos: React.ReactNode;
}) {
  const t = useTranslations("Administracion");
  const [view, setView] = useTabParam("vista", VIEWS);

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as (typeof VIEWS)[number])}
    >
      <TabsList variant="default">
        <TabsTrigger value="roles">{t("navRoles")}</TabsTrigger>
        <TabsTrigger value="permisos">{t("matrixTitle")}</TabsTrigger>
      </TabsList>
      <TabsContent value="roles">{roles}</TabsContent>
      <TabsContent value="permisos">{permisos}</TabsContent>
    </Tabs>
  );
}
