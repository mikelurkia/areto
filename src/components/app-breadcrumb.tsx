"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Primer segmento de la ruta → sección del menú. El enlace no siempre es el
 * segmento (Administración apunta a su primera subpágina), igual que en
 * `nav-items`.
 */
const SECTIONS: Record<string, { key: string; href: string }> = {
  dashboard: { key: "dashboard", href: "/dashboard" },
  personas: { key: "personas", href: "/personas" },
  socios: { key: "socios", href: "/socios" },
  inscripciones: { key: "inscripciones", href: "/inscripciones" },
  medico: { key: "medico", href: "/medico" },
  temporadas: { key: "temporada", href: "/temporadas" },
  equipos: { key: "equipos", href: "/equipos" },
  calendario: { key: "calendario", href: "/calendario" },
  patrocinadores: { key: "patrocinadores", href: "/patrocinadores" },
  cuotas: { key: "cuotas", href: "/cuotas" },
  avisos: { key: "avisos", href: "/avisos" },
  club: { key: "club", href: "/club" },
  administracion: { key: "administracion", href: "/administracion/usuarios" },
};

/**
 * Migas de pan de la cabecera.
 *
 * Se deducen de la ruta y no las declara cada página: nombrar aquí las
 * secciones —que son fijas y ya están traducidas— cubre el caso útil, que es
 * volver al listado desde una ficha, sin obligar a tocar veinte páginas.
 *
 * Por eso mismo una ficha no añade una miga con su nombre: ese nombre solo lo
 * conoce la página, que ya lo muestra en su título.
 */
export function AppBreadcrumb() {
  const t = useTranslations("Nav");
  const tAdmin = useTranslations("Administracion");
  const tSidebar = useTranslations("Sidebar");
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const [first, second] = segments;

  const crumbs: { label: string; href?: string }[] = [];

  if (first === "ajustes") {
    crumbs.push({ label: tSidebar("settings") });
  } else {
    const section = SECTIONS[first ?? ""];
    if (!section) return null;

    const subsection =
      first === "administracion" && (second === "usuarios" || second === "roles")
        ? tAdmin(second === "roles" ? "navRoles" : "navUsers")
        : null;

    // La sección es enlace siempre que no sea la pantalla en la que se está:
    // desde una ficha, esta miga es la vuelta al listado.
    const sectionIsCurrent = segments.length === 1;
    crumbs.push({
      label: t(section.key as "dashboard"),
      href: sectionIsCurrent ? undefined : section.href,
    });
    if (subsection) crumbs.push({ label: subsection });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          // Fragmento y no un envoltorio: los hijos de la lista tienen que ser
          // sus elementos, no un `<span>` por medio.
          <Fragment key={crumb.label}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink render={<Link href={crumb.href} />}>
                  {crumb.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
