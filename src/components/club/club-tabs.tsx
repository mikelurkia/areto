"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

/** Primera vista = la de por defecto, la que no deja parámetro en la URL. */
const VIEWS = [
  "datos",
  "firmantes",
  "inscripciones",
  "pagos",
  "medico",
  "federaciones",
] as const;

/** Sin permiso sobre las tarjetas, "pagos" no es una vista válida: si no se
 * quitara de la lista, un `?vista=pagos` a mano dejaría el contenedor vacío. */
const VIEWS_WITHOUT_PAYMENTS = VIEWS.filter((v) => v !== "pagos");

/**
 * Reparte `/club` en sus pestañas. El contenido lo sigue renderizando el
 * servidor y llega por props: aquí solo se decide cuál se ve.
 *
 * `pagos` es opcional: llega `undefined` a quien no tiene `club.payments.view`,
 * y entonces ni se pinta el trigger ni se admite en la URL.
 *
 * Subrayado (variante por defecto de `TabsList`), no píldora: a diferencia de
 * Administración, aquí no hay una segunda fila de navegación encima con la
 * que pueda confundirse.
 */
export function ClubTabs({
  datos,
  firmantes,
  inscripciones,
  pagos,
  medico,
  federaciones,
}: {
  datos: React.ReactNode;
  firmantes: React.ReactNode;
  inscripciones: React.ReactNode;
  pagos?: React.ReactNode;
  medico: React.ReactNode;
  federaciones: React.ReactNode;
}) {
  const t = useTranslations("Club");
  const [view, setView] = useTabParam(
    "vista",
    pagos ? VIEWS : VIEWS_WITHOUT_PAYMENTS,
  );

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as (typeof VIEWS)[number])}
    >
      <TabsList>
        <TabsTrigger value="datos">{t("tabDatos")}</TabsTrigger>
        <TabsTrigger value="firmantes">{t("tabFirmantes")}</TabsTrigger>
        <TabsTrigger value="inscripciones">{t("tabInscripciones")}</TabsTrigger>
        {pagos ? <TabsTrigger value="pagos">{t("tabPagos")}</TabsTrigger> : null}
        <TabsTrigger value="medico">{t("tabMedico")}</TabsTrigger>
        <TabsTrigger value="federaciones">{t("tabFederaciones")}</TabsTrigger>
      </TabsList>
      <TabsContent value="datos">{datos}</TabsContent>
      <TabsContent value="firmantes">{firmantes}</TabsContent>
      <TabsContent value="inscripciones">{inscripciones}</TabsContent>
      {pagos ? <TabsContent value="pagos">{pagos}</TabsContent> : null}
      <TabsContent value="medico">{medico}</TabsContent>
      <TabsContent value="federaciones">{federaciones}</TabsContent>
    </Tabs>
  );
}
