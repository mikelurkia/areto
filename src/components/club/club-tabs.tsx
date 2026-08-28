"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

/** Primera vista = la de por defecto, la que no deja parámetro en la URL. */
const VIEWS = ["datos", "firmantes", "inscripciones", "medico", "federaciones"] as const;

/**
 * Reparte `/club` en cinco pestañas. El contenido lo sigue renderizando el
 * servidor y llega por props: aquí solo se decide cuál se ve.
 *
 * Subrayado (variante por defecto de `TabsList`), no píldora: a diferencia de
 * Administración, aquí no hay una segunda fila de navegación encima con la
 * que pueda confundirse.
 */
export function ClubTabs({
  datos,
  firmantes,
  inscripciones,
  medico,
  federaciones,
}: {
  datos: React.ReactNode;
  firmantes: React.ReactNode;
  inscripciones: React.ReactNode;
  medico: React.ReactNode;
  federaciones: React.ReactNode;
}) {
  const t = useTranslations("Club");
  const [view, setView] = useTabParam("vista", VIEWS);

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as (typeof VIEWS)[number])}
    >
      <TabsList>
        <TabsTrigger value="datos">{t("tabDatos")}</TabsTrigger>
        <TabsTrigger value="firmantes">{t("tabFirmantes")}</TabsTrigger>
        <TabsTrigger value="inscripciones">{t("tabInscripciones")}</TabsTrigger>
        <TabsTrigger value="medico">{t("tabMedico")}</TabsTrigger>
        <TabsTrigger value="federaciones">{t("tabFederaciones")}</TabsTrigger>
      </TabsList>
      <TabsContent value="datos">{datos}</TabsContent>
      <TabsContent value="firmantes">{firmantes}</TabsContent>
      <TabsContent value="inscripciones">{inscripciones}</TabsContent>
      <TabsContent value="medico">{medico}</TabsContent>
      <TabsContent value="federaciones">{federaciones}</TabsContent>
    </Tabs>
  );
}
