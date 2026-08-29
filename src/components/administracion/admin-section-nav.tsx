import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Sub-navegación de la sección de administración.
 *
 * Componente de servidor y con la pestaña activa recibida por prop, en vez de
 * leer `usePathname`: así no arrastra un límite de cliente ni obliga a
 * envolverlo en `<Suspense>`, que es lo que hubo que hacer con el selector de
 * idioma de la cabecera.
 */
export async function AdminSectionNav({
  current,
  canManageRoles,
  canViewAudit,
}: {
  current: "usuarios" | "roles" | "auditoria";
  canManageRoles: boolean;
  canViewAudit: boolean;
}) {
  const t = await getTranslations("Administracion");

  const items = [
    { key: "usuarios" as const, href: "/administracion/usuarios", label: t("navUsers") },
    ...(canManageRoles
      ? [{ key: "roles" as const, href: "/administracion/roles", label: t("navRoles") }]
      : []),
    ...(canViewAudit
      ? [{ key: "auditoria" as const, href: "/administracion/auditoria", label: t("navAudit") }]
      : []),
  ];

  return (
    <nav className="flex gap-1 border-b">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            item.key === current
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
