import { Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { hasPermission, requirePermission } from "@/lib/auth";
import {
  hasActiveFilters,
  loadCurrentTeamOptions,
  loadPersonPage,
  loadPersonTagOptions,
  parsePersonFilters,
} from "@/lib/person-list";
import { Link } from "@/i18n/navigation";
import { PersonasBrowser } from "@/components/personas/personas-browser";
import { PersonDialog } from "@/components/personas/person-dialog";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("personas") };
}

/**
 * Restringido a admin/staff: la ficha de persona incluye DNI, IBAN, dirección
 * y datos médicos de todo el club, no solo de quien consulta.
 */
export default async function PersonasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("personas.view");
  const t = await getTranslations("Personas");
  const canManage = hasPermission(user, "personas.manage");

  // Los filtros viven en la URL y se resuelven en SQL: de la tabla `persons`
  // solo suben las 25 filas de la página. El diálogo de alta ya no recibe la
  // lista de personas del club para elegir tutor; la busca al escribir.
  const filters = parsePersonFilters(await searchParams);
  const [personPage, teamOptions, tagOptions] = await Promise.all([
    loadPersonPage(filters),
    loadCurrentTeamOptions(),
    loadPersonTagOptions(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/personas/duplicados" />}
              nativeButton={false}
            >
              {t("reviewDuplicatesAction")}
            </Button>
            <PersonDialog mode="create" />
          </div>
        ) : null}
      </div>

      {/* El vacío real (club sin personas) se distingue de "ningún resultado":
          sin filtros aplicados y sin filas, no hay nada que buscar todavía. */}
      {personPage.total === 0 && !hasActiveFilters(filters) ? (
        <SectionPlaceholder
          icon={Users}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <PersonasBrowser
          persons={personPage.rows}
          total={personPage.total}
          pageCount={personPage.pageCount}
          page={personPage.page}
          teamOptions={teamOptions}
          tagOptions={tagOptions}
          canManage={canManage}
        />
      )}
    </div>
  );
}
